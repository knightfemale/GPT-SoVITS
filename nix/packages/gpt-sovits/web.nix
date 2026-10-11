# 前端（web/）构建派生：用 pnpm 离线构建 React SPA，产物进 store。
#
# 采用 nixpkgs 的 pnpm 钩子：
#   - pnpmConfigHook：用 fetchPnpmDeps 预先取好的离线 store 配置依赖（零联网）；
#   - pnpmBuildHook：默认执行 `pnpm run build`（package.json: tsc --noEmit && vite build）。
#
# pnpm 大版本固定为 pnpm_12（=12.9.0），与 pnpm-lock.yaml 的 lockfileVersion 9.0
# 及设计者使用的版本一致。
{
  lib,
  stdenvNoCC,
  nodejs_22,
  pnpm_12,
  fetchPnpmDeps,
  pnpmConfigHook,
  pnpmBuildHook,
}:

stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "gpt-sovits-web";
  version = "0.1.0";

  # 只取 web/ 源，排除本地构建残留（node_modules/dist/.vite）以保证可复现。
  src = lib.cleanSourceWith {
    src = ../../../web;
    filter =
      path: type:
      let
        base = baseNameOf (toString path);
      in
      !(builtins.elem base [
        "node_modules"
        "dist"
        ".vite"
      ]);
  };

  pnpmDeps = fetchPnpmDeps {
    inherit (finalAttrs) pname version src;
    pnpm = pnpm_12;
    fetcherVersion = 4;
    hash = "sha256-+R+DBScJL/P/dDR3vwSxPV3U580gPCSdaqjm3DEfaZ8=";
  };

  nativeBuildInputs = [
    nodejs_22
    pnpm_12
    pnpmConfigHook
    pnpmBuildHook
  ];

  # 产物落到 $out（StaticFiles 根）：index.html + assets/。
  installPhase = ''
    runHook preInstall
    mkdir -p $out
    cp -r dist/. $out/
    runHook postInstall
  '';

  meta = {
    description = "GPT-SoVITS webui-ng single-page frontend (built with pnpm)";
    homepage = "https://github.com/RVC-Boss/GPT-SoVITS";
    license = lib.licenses.mit;
    platforms = lib.platforms.linux;
  };
})
