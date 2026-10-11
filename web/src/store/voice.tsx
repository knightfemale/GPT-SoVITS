import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import type { ModelEntry } from "@/lib/api/types";
import { checkPairing, versionOf, versionLabel } from "@/lib/versions";
import { useApiClient } from "@/hooks/useApi";
import { queryKeys } from "@/hooks/queries";
import { useLocalStorage } from "@/lib/hooks";

export interface VoiceSelection {
  sovitsPath: string | null;
  gptPath: string | null;
  referenceId: string | null;
  referenceName: string | null;
}

const EMPTY_SELECTION: VoiceSelection = {
  sovitsPath: null,
  gptPath: null,
  referenceId: null,
  referenceName: null,
};

interface VoiceContextValue {
  selection: VoiceSelection;
  setSelection: (patch: Partial<VoiceSelection>) => void;
  isSwitching: boolean;
  switchError: string | null;
  /** 已成功热切换的版本（后端返回）。 */
  activeVersion: string | null;
  /** 全局切换锁：切换进行中时禁用合成等操作。 */
  isLocked: boolean;
  switchWeights: (sovits?: ModelEntry | null, gpt?: ModelEntry | null) => Promise<boolean>;
  clearSwitchError: () => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [selection, setSelectionState] = useLocalStorage<VoiceSelection>("gsv.voice", EMPTY_SELECTION);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [activeVersion, setActiveVersion] = useState<string | null>(null);

  const setSelection = useCallback(
    (patch: Partial<VoiceSelection>) => setSelectionState((prev) => ({ ...prev, ...patch })),
    [setSelectionState],
  );

  const mutation = useMutation({
    mutationFn: (vars: { sovits?: ModelEntry | null; gpt?: ModelEntry | null }) =>
      api.switchModel({
        sovits_path: vars.sovits?.path,
        gpt_path: vars.gpt?.path,
      }),
  });

  const switchWeights = useCallback(
    async (sovits?: ModelEntry | null, gpt?: ModelEntry | null): Promise<boolean> => {
      setSwitchError(null);

      const sovitsVersion = sovits ? versionOf(sovits) : null;
      const gptVersion = gpt ? versionOf(gpt) : null;
      const pairing = checkPairing(sovitsVersion, gptVersion);
      if (!pairing.ok) {
        setSwitchError(pairing.reason ?? "版本配对校验未通过");
        return false;
      }

      const previous = selection;
      // 乐观更新 + 全局锁定
      setSelection({
        sovitsPath: sovits?.path ?? selection.sovitsPath,
        gptPath: gpt?.path ?? selection.gptPath,
      });

      try {
        const res = await mutation.mutateAsync({ sovits, gpt });
        setActiveVersion(res.version ?? (sovitsVersion && versionLabel(sovitsVersion)) ?? null);
        await queryClient.invalidateQueries({ queryKey: queryKeys.models });
        return true;
      } catch (err) {
        // 失败回滚
        setSelectionState(previous);
        const message =
          err instanceof ApiError
            ? `切换失败（${err.status}）：${err.body || err.message}`
            : err instanceof Error
              ? err.message
              : "切换失败";
        setSwitchError(message);
        return false;
      }
    },
    [api, mutation, queryClient, selection, setSelection, setSelectionState],
  );

  const value = useMemo<VoiceContextValue>(
    () => ({
      selection,
      setSelection,
      isSwitching: mutation.isPending,
      switchError,
      activeVersion,
      isLocked: mutation.isPending,
      switchWeights,
      clearSwitchError: () => setSwitchError(null),
    }),
    [selection, setSelection, mutation.isPending, switchError, activeVersion, switchWeights],
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice 必须在 VoiceProvider 内使用");
  return ctx;
}
