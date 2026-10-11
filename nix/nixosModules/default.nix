{
  inputs,
}:
{
  lib,
  pkgs,
  config,
  ...
}:
let
  cfg = config.services.gpt-sovits;

  system = pkgs.stdenv.hostPlatform.system;

  # The runnable program exported by this flake. It provides the single
  # bin/gpt-sovits-webui-ng entrypoint.
  # `acceleration` selects the CPU or the CUDA (prebuilt wheels) variant;
  # an explicit `package` overrides this entirely.
  defaultPackage = inputs.self.packages.${system}.gpt-sovits.override {
    inherit (cfg) acceleration;
  };

  # By default a StateDirectory is used; anything else needs its own directory
  # and a hole in the unit's mount namespace.
  isDefaultDataDir = cfg.dataDir == "/var/lib/gpt-sovits";

  # Static catalogue of the pretrained models (data only, no `pkgs` needed).
  # Scope: TTS inference/fine-tuning weights only. The auxiliary toolboxes
  # (ASR / faster-whisper / uvr5 / nltk_data / open_jtalk) are intentionally NOT
  # covered here; the inlined download guards make their runtime downloads a
  # hard local-path error, so they stay offline but need user-supplied data.
  catalog = import ./model-catalog.nix { inherit lib; };

  # --- model selection ---------------------------------------------------
  # `mandatory` entries (the base BERT/HuBERT/G2PW models) are always kept; the
  # rest are kept when their `versions` intersect `cfg.versions`. `trainingOnly`
  # weights (s2D discriminators, the eres2net speaker model) are dropped unless
  # `withDiscriminator` is enabled.
  trainingOk = x: cfg.withDiscriminator || !(x.trainingOnly or false);
  versionOk = versions: versions == [ ] || lib.intersectLists versions cfg.versions != [ ];
  fileEntrySelected = e: (e.mandatory or false) || versionOk (e.versions or [ ]);
  bundleFileOk = e: f: fileEntrySelected e && versionOk (f.versions or [ ]) && trainingOk f;

  # URL of a single file, honouring `modelSource`. `f.repo` selects the mirror
  # root ("lj1995" default, or "xxxxrt" for artifacts only in the packed repo).
  # ModelScope lacks the v5 weights, so anything under `gsv-v5-pretrained/`
  # falls back to HuggingFace even when this is `"modelscope"`.
  urlFor =
    f:
    let
      repo = f.repo or "lj1995";
      base = catalog.repos.${repo};
      msPath = f.msPath or f.hfPath;
    in
    if cfg.modelSource == "modelscope" then
      if msPath == null || (repo == "lj1995" && lib.hasPrefix "gsv-v5-pretrained/" f.hfPath) then
        "${catalog.repos.lj1995.huggingface}/${f.hfPath}"
      else
        "${base.modelscope}/${msPath}"
    else
      "${base.${cfg.modelSource}}/${f.hfPath}";

  fetchFile =
    f:
    pkgs.fetchurl {
      url = urlFor f;
      hash = f.hash;
      name = baseNameOf f.hfPath;
    };

  g2pwUrl =
    if cfg.modelSource == "modelscope" then
      catalog.g2pwZip.modelscope
    else if cfg.modelSource == "hf-mirror" then
      catalog.g2pwZip.hfMirror
    else
      catalog.g2pwZip.hf;

  # One `{ installPath, name, drv }` per catalogue entry that survives filtering.
  catalogItems = lib.concatMap (
    e:
    if e.kind == "dir" then
      let
        files = lib.filter (bundleFileOk e) e.files;
      in
      lib.optional (files != [ ]) {
        inherit (e) installPath name;
        drv = pkgs.runCommand e.name { } (
          "mkdir -p $out\n" + lib.concatMapStringsSep "\n" (f: "ln -s ${fetchFile f} $out/${f.name}") files
        );
      }
    else if e.kind == "g2pw" then
      lib.optional (fileEntrySelected e) {
        inherit (e) installPath name;
        drv = pkgs.runCommand "G2PWModel" { nativeBuildInputs = [ pkgs.unzip ]; } ''
          mkdir -p $out
          unzip -q ${
            pkgs.fetchurl {
              url = g2pwUrl;
              hash = catalog.g2pwZip.hash;
            }
          } -d $out
          mv $out/G2PWModel/* $out/
          rmdir $out/G2PWModel
        '';
      }
    else
      lib.optional (fileEntrySelected e && trainingOk e) {
        inherit (e) installPath name;
        drv = fetchFile e;
      }
  ) catalog.entries;

  # User-supplied models from `cfg.models` (one item per install path).
  userItems = lib.concatMap (
    m:
    map (p: {
      installPath = p;
      inherit (m) name;
      drv = pkgs.fetchurl (lib.filterAttrs (n: _: n == "name" || n == "url" || n == "hash") m);
    }) m.installPaths
  ) cfg.models;

  # Deduplicate by (installPath, name): shared files (s1v3.ckpt, the v5 vocoder)
  # collapse to a single link, and a user entry of the same path wins.
  allItems = lib.foldl' (
    acc: x:
    if lib.any (y: y.installPath == x.installPath && y.name == x.name) acc then acc else acc ++ [ x ]
  ) [ ] (userItems ++ catalogItems);

  # Unique configured install paths below dataDir, used to bound the stale
  # symlink sweep to directories the module actually manages.
  modelInstallDirs = lib.unique (map (x: x.installPath) allItems);

  modelSymlinks = lib.concatMapStringsSep "\n" (x: ''
    mkdir -p ${lib.escapeShellArg "${cfg.dataDir}/${x.installPath}"}
    # Remove any pre-existing entry first: `ln -sn` does not replace an existing
    # real file/directory — it would create the link *inside* a stale directory,
    # leaving old model files in place. Safe: installPath/name are validated
    # below (no absolute/`..`), so this stays within dataDir.
    rm -rf ${lib.escapeShellArg "${cfg.dataDir}/${x.installPath}/${x.name}"}
    ln -sn ${lib.escapeShellArg "${x.drv}"} ${lib.escapeShellArg "${cfg.dataDir}/${x.installPath}/${x.name}"}
  '') allItems;

  # Remove stale store symlinks below the managed install paths before relinking
  # so no stale links are left behind after an upgrade. ONLY dirs under
  # `models/**` are swept; other install paths (e.g. `g2pw`) are handled by
  # `modelSymlinks`, which removes the exact entry it recreates.
  staleSymlinkSweep = lib.concatMapStringsSep "\n" (p: ''
    dstReal="$(readlink -f ${lib.escapeShellArg cfg.dataDir} 2>/dev/null || true)"
    real="$(readlink -f ${lib.escapeShellArg "${cfg.dataDir}/${p}"} 2>/dev/null || true)"
    if [[ -n "$real" && -d "$real" && -n "$dstReal" && "$real" == "$dstReal"/models/* ]]; then
      stale=()
      readarray -d "" stale < <(find "$real" -type l -print0)
      for link in "''${stale[@]}"; do
        if [[ "$(readlink "$link")" == ${lib.escapeShellArg builtins.storeDir}/* ]]; then
          rm "$link"
        fi
      done
    fi
  '') modelInstallDirs;

  runtimeCaches = [
    "HF_HOME=${cfg.dataDir}/huggingface"
    "MODELSCOPE_CACHE=${cfg.dataDir}/modelscope"
  ];

  # Read-only packaged source exported by the app derivation (`passthru.source`).
  # It is the app's cwd / code root; the service never writes into it.
  packageSource = cfg.package.source or null;

  # ---- Writable runtime layout (see `runtimeLayout` below) ----
  #
  # The app runs directly from the read-only store source (wrapper `cd`), so cwd
  # carries no data. All writable runtime state lives under dataDir and is
  # exposed to the process via `GPT_SOVITS_DATA_DIR`, in a consolidated layout:
  #
  #   models/  <- pretrained_models + SoVITS_weights*/ + GPT_weights*/ + uvr5_weights
  #   train/   <- dataset/ + logs/
  #   output/  <- generated audio
  #   tmp/ references/ g2pw/ huggingface/ modelscope/
  #
  # The wrapper/Python code resolves these through config.py, so no cwd farming is
  # required.
  weightDirs = [
    "SoVITS_weights"
    "SoVITS_weights_v2"
    "SoVITS_weights_v3"
    "SoVITS_weights_v4"
    "SoVITS_weights_v5dev"
    "SoVITS_weights_v5turbo"
    "SoVITS_weights_v2Pro"
    "SoVITS_weights_v2ProPlus"
    "GPT_weights"
    "GPT_weights_v2"
    "GPT_weights_v3"
    "GPT_weights_v4"
    "GPT_weights_v5dev"
    "GPT_weights_v5turbo"
    "GPT_weights_v2Pro"
    "GPT_weights_v2ProPlus"
  ];

  # Top-level source entries are NOT farmed here anymore: the app runs directly
  # from the read-only store source (wrapper `cd ${source}`), and all writable
  # runtime state lives under `dataDir` via `GPT_SOVITS_DATA_DIR`.

  # Materialise the writable runtime dirs under dataDir. Idempotent and
  # non-destructive: only `mkdir -p` (no farm/relink/copy), so user data is
  # never touched. The code itself runs from the read-only store source.
  runtimeLayout = lib.optionalString (packageSource != null) (
    let
      q = lib.escapeShellArg;
      weights = lib.concatStringsSep " " (map q weightDirs);
    in
    ''
      dst=${q cfg.dataDir}
      mkdir -p "$dst"/models/pretrained_models "$dst"/models/uvr5_weights \
        "$dst"/train/dataset "$dst"/train/logs \
        "$dst"/output "$dst"/tmp "$dst"/tmp/ja_userdic \
        "$dst"/references "$dst"/configs "$dst"/g2pw \
        "$dst"/huggingface "$dst"/modelscope
      for w in ${weights}; do mkdir -p "$dst/models/$w"; done
    ''
  );

  # A configured relative path is unsafe when it is absolute or contains a `..`
  # component; either would let the created link escape dataDir.
  isUnsafeRelPath =
    p:
    let
      s = toString p;
    in
    lib.hasPrefix "/" s || lib.elem ".." (lib.splitString "/" s);
in
{
  options.services.gpt-sovits = {
    enable = lib.mkEnableOption "GPT-SoVITS inference API and WebUI";

    acceleration = lib.mkOption {
      type = lib.types.enum [
        "cpu"
        "cuda"
      ];
      default = "cpu";
      description = ''
        Torch acceleration backend.
        `"cuda"` uses prebuilt CUDA wheels (torch-bin / torchaudio-bin) pinned
        to `cudaPackages_13_3`; `"cpu"` keeps the CPU-only wheel set.
        Setting `package` explicitly overrides this choice.
      '';
    };

    package = lib.mkOption {
      type = lib.types.package;
      default = defaultPackage;
      defaultText = lib.literalExpression "inputs.self.packages.\${pkgs.stdenv.hostPlatform.system}.gpt-sovits.override { acceleration = ...; }";
      description = ''
        The GPT-SoVITS package to run. It must provide the
        `bin/gpt-sovits-webui-ng` entrypoint.
      '';
    };

    host = lib.mkOption {
      type = lib.types.str;
      default = "127.0.0.1";
      example = "0.0.0.0";
      description = "The address on which the GPT-SoVITS API listens.";
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 9880;
      example = 1234;
      description = "The port on which the GPT-SoVITS API listens.";
    };

    dataDir = lib.mkOption {
      type = lib.types.path;
      default = "/var/lib/gpt-sovits";
      example = "/srv/gpt-sovits";
      description = ''
        Directory holding GPT-SoVITS state, including fine-tuned models.
        It must stay writable at runtime because training/fine-tuning writes
        checkpoints and logs there.

        Defaults to the unit's `StateDirectory`.
        Any other directory is created with systemd-tmpfiles and bind-mounted
        into the service.

        Existing state is not migrated, you need to move it yourself.
      '';
    };

    user = lib.mkOption {
      type = lib.types.str;
      default = "gpt-sovits";
      description = "User account under which the service runs.";
    };

    group = lib.mkOption {
      type = lib.types.str;
      default = "gpt-sovits";
      description = "Group under which the service runs.";
    };

    openFirewall = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = ''
        Whether to open `port` in the firewall.

        Note: `host` defaults to `127.0.0.1`, so the API only listens
        locally. To expose it on the network you must set `host` (e.g.
        `0.0.0.0`) **in addition to** enabling this option; opening the
        firewall alone does not make the service reachable remotely.
      '';
    };

    environmentFile = lib.mkOption {
      type = lib.types.nullOr (lib.types.either lib.types.path lib.types.str);
      default = null;
      example = "/run/secrets/gpt-sovits.env";
      description = ''
        Optional systemd `EnvironmentFile` with additional environment
        variables, e.g. secrets for the API.
      '';
    };

    extraArgs = lib.mkOption {
      type = with lib.types; listOf str;
      default = [ ];
      example = [
        "--infer_mode"
        "normal"
      ];
      description = ''
        Extra arguments appended to `bin/gpt-sovits-webui-ng`.
      '';
    };

    models = lib.mkOption {
      type = lib.types.listOf (
        lib.types.submodule {
          options = {
            name = lib.mkOption {
              type = lib.types.str;
              description = ''
                Required. The model file name, used as the link name in
                `<dataDir>/<installPath>/<name>`. It must be unique within the
                same `<installPath>` to avoid conflicts. Must be a relative
                path below `dataDir` (no absolute path and no `..` component).
              '';
            };
            url = lib.mkOption {
              type = lib.types.str;
              description = ''
                Required. The download URL of the model file. Pinned-resolve
                URLs (e.g. HuggingFace's `/resolve/<commit>/<file>`) are
                recommended to have a stable hash.
              '';
            };
            hash = lib.mkOption {
              type = lib.types.str;
              example = lib.fakeHash;
              description = ''
                Required. The SRI hash of the model file. Generate it with
                `nix-prefetch-url <url>`, or set this to `lib.fakeHash`, build
                once and copy the hash from the error message.
              '';
            };
            installPaths = lib.mkOption {
              # A directory string is converted to a one-element list.
              type = with lib.types; coercedTo str lib.singleton (nonEmptyListOf str);
              description = ''
                Required. The target subdirectories below `dataDir` into which
                the model is symlinked: for each path `p`, a symlink is created
                at `<dataDir>/<p>/<name>`. Example values are
                `models/pretrained_models/s1bert` or `models/pretrained_models`.

                Nested paths are allowed. A single string is upgraded to a
                one-element list. One symlink is created per install path.

                Each entry must be a relative path below `dataDir` (no absolute
                path and no `..` component), otherwise it could escape the data
                directory.
              '';
              example = [ "models/pretrained_models" ];
            };
          };
        }
      );
      default = [ ];
      example = lib.literalExpression ''
        [ {
          name = "gsv-v4-pretrained.zip";
          url = "https://example.com/gsv-v4-pretrained.zip";
          hash = "sha256-AAAA...";
          installPaths = "models/pretrained_models";
        } ]
      '';
      description = ''
        Models to fetch and symlink into
        `''${services.gpt-sovits.dataDir}/<installPath>/<name>`, so the service
        never needs network access at runtime. Files placed manually in the
        same directories are left untouched.

        This is an escape hatch on top of the built-in catalogue selected via
        `versions`/`withDiscriminator`/`modelSource`; an entry whose
        `<installPath>/<name>` collides with a catalogue entry overrides it.
      '';
    };

    versions = lib.mkOption {
      type = lib.types.listOf (
        lib.types.enum [
          "v1"
          "v2"
          "v3"
          "v4"
          "v5dev"
          "v5turbo"
          "v2Pro"
          "v2ProPlus"
        ]
      );
      default = [ ];
      example = [
        "v2"
        "v2Pro"
      ];
      description = ''
        Pretrained model versions to fetch and symlink into `dataDir`. An empty
        list (the default) fetches only the mandatory base models
        (`chinese-roberta-wwm-ext-large`, `chinese-hubert-base` and
        `G2PWModel`), which are always linked regardless of this option.

        There is no bare `v5`: it is a family name covering `v5dev` and
        `v5turbo`. Shared weights (`s1v3.ckpt`, the v5 vocoder) are linked once.
      '';
    };

    withDiscriminator = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = ''
        Also fetch the training-only weights for the selected `versions`: the
        `s2D` discriminator checkpoints (v1/v2/v2Pro/v2ProPlus) and the
        `sv/pretrained_eres2netv2w24s4ep4.ckpt` speaker model (v2Pro/v2ProPlus).
        Not needed for pure inference, hence off by default. v3/v4/v5 have no
        discriminator weights.
      '';
    };

    modelSource = lib.mkOption {
      type = lib.types.enum [
        "huggingface"
        "hf-mirror"
        "modelscope"
      ];
      default = "huggingface";
      description = ''
        Mirror to download the pretrained models from.

        `"huggingface"` and `"hf-mirror"` use the upstream
        `lj1995/GPT-SoVITS` repository; `"modelscope"` uses
        `XXXXRT/GPT-SoVITS-Pretrained`. ModelScope does not carry the v5
        weights, so any file under `gsv-v5-pretrained/` falls back to
        HuggingFace even when this is `"modelscope"`.
      '';
    };
  };

  config = lib.mkIf cfg.enable {
    assertions = [
      {
        assertion = !isDefaultDataDir -> lib.hasPrefix "/" (toString cfg.dataDir);
        message = "services.gpt-sovits.dataDir must be an absolute path.";
      }
      {
        assertion = lib.all (
          m: !(lib.any isUnsafeRelPath m.installPaths) && !(isUnsafeRelPath m.name)
        ) cfg.models;
        message = ''
          services.gpt-sovits.models: `name` and every `installPaths` entry must
          be relative paths below `dataDir`, and must not be absolute or contain
          a `..` component (that would escape the data directory).
        '';
      }
      {
        # The built-in catalogue is trusted data, but validate it too so a
        # typo there can never create a link escaping dataDir.
        assertion = lib.all (x: !(isUnsafeRelPath x.installPath) && !(isUnsafeRelPath x.name)) allItems;
        message = ''
          services.gpt-sovits: the built-in model catalogue produced an unsafe
          install path (absolute or containing `..`); this is an internal bug.
        '';
      }
    ];

    # owner read back from the unit, not spelled out: StateDirectory= infers it,
    # this rule has to be told.
    systemd.tmpfiles.settings = lib.mkIf (!isDefaultDataDir) {
      "10-gpt-sovits".${cfg.dataDir}.d = {
        user = cfg.user;
        group = cfg.group;
        mode = "0700";
      };
    };

    systemd.services.gpt-sovits = {
      description = "GPT-SoVITS inference API and WebUI";
      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" ];

      preStart = ''
        # Fail loudly: a broken link/mkdir must not leave a half-built tree that
        # still "starts" (which would silently break G2PW/uvr5/asr paths).
        set -euo pipefail

        ${lib.optionalString (packageSource == null) ''
          # A custom `services.gpt-sovits.package` may lack `passthru.source`;
          # in that case there is nothing to seed. Surface it instead of
          # silently doing nothing.
          echo "warning: 自定义 package 未提供 passthru.source，跳过源码播种" >&2
        ''}

        ${runtimeLayout}

        # Rebuild model symlinks, after clearing any stale ones pointing into
        # the Nix store from a previous generation.
        ${staleSymlinkSweep}

        ${modelSymlinks}
      '';

      serviceConfig = {
        ExecStart = lib.escapeShellArgs ([ "${cfg.package}/bin/gpt-sovits-webui-ng" ] ++ cfg.extraArgs);

        User = cfg.user;
        Group = cfg.group;
        # The launcher chdirs to the read-only store source itself (see the
        # package wrapper); dataDir only holds writable runtime state.
        WorkingDirectory = if packageSource != null then toString packageSource else cfg.dataDir;
        Type = "simple";
        Restart = "always";
        RestartSec = "5sec"; # don't crash loop immediately

        StateDirectory = lib.mkIf isDefaultDataDir "gpt-sovits";
        StateDirectoryMode = "700";
        RuntimeDirectoryMode = "700";

        # This is a bind mount, not ReadWritePaths, so that with ProtectHome it
        # is not shadowed by a tmpfs.
        BindPaths = lib.mkIf (!isDefaultDataDir) [ cfg.dataDir ];

        EnvironmentFile = lib.mkIf (cfg.environmentFile != null) [
          (toString cfg.environmentFile)
        ];

        # Keep runtime fully offline: HuggingFace/transformers must not hit the
        # hub, and caches are redirected into the writable dataDir.
        # NOTE: modelscope 1.39.1 / modelscope-hub 0.2.0 expose no documented
        # global offline env var; MODELSCOPE_OFFLINE is set as a best effort
        # and MODELSCOPE_CACHE points at the pre-populated writable cache.
        Environment = [
          "HF_HUB_OFFLINE=1"
          "TRANSFORMERS_OFFLINE=1"
          "HF_DATASETS_OFFLINE=1"
          "MODELSCOPE_OFFLINE=1"
          # The launcher chdirs to the read-only store source; all writable runtime
          # state lives under dataDir, exposed to the app via GPT_SOVITS_DATA_DIR.
          "PYTHONDONTWRITEBYTECODE=1"
          "GPT_SOVITS_DATA_DIR=${cfg.dataDir}"
        ]
        ++ [
          # webui_ng reads its bind address/port from the environment.
          "GPT_SOVITS_WEBUI_HOST=${cfg.host}"
          "GPT_SOVITS_WEBUI_PORT=${toString cfg.port}"
        ]
        ++ runtimeCaches;

        # required for Torch and ONNX Runtime
        BindReadOnlyPaths = [ "/proc/cpuinfo" ];
        PrivateDevices = false;
        ProcSubset = "all";

        CapabilityBoundingSet = [ "" ];
        DeviceAllow = null;
        LockPersonality = true;
        NoNewPrivileges = true;
        PrivateTmp = true;
        PrivateUsers = true;
        ProtectClock = true;
        ProtectControlGroups = true;
        ProtectHome = "tmpfs";
        ProtectHostname = true;
        ProtectKernelLogs = true;
        ProtectKernelModules = true;
        ProtectKernelTunables = true;
        ProtectProc = "invisible";
        ProtectSystem = "strict";
        RemoveIPC = true;
        RestrictAddressFamilies = [
          "AF_INET"
          "AF_INET6"
          "AF_UNIX"
        ];
        RestrictNamespaces = true;
        RestrictRealtime = true;
        RestrictSUIDSGID = true;
        SystemCallArchitectures = "native";
        SystemCallFilter = [ "@system-service" ];
      };
    };

    networking.firewall.allowedTCPPorts = lib.mkIf cfg.openFirewall [ cfg.port ];

    users = {
      groups.${cfg.group} = { };
      users.${cfg.user} = {
        group = cfg.group;
        home = cfg.dataDir;
        isSystemUser = true;
      };
    };
  };
}
