{
  lib,
  pkgs,
  inputs,
  acceleration ? "cpu",
  torchCudaPackages ? pkgs.cudaPackages_13_3,
  ...
}:
let
  system = pkgs.stdenv.hostPlatform.system;

  # 2024-11-01 快照的完整包集（顶层 + python），仅用于复用其 `src` 及与
  # python 绑定同版本的 C++ 库（ctranslate2），构建与依赖解析仍在本 scope 内进行。
  multiverse2024 = inputs.nixpkgs-multiverse.multiverse.${system}.at "2024-11-01";

  # 旧版（numpy<2 时代）python 包，仅用于复用其 `src`（固定输出派生），
  # 构建与依赖解析仍在本 scope 内进行。
  multiversePs = multiverse2024.python312Packages;

  # 2025-06 快照：transformers 4.52.4 / tokenizers 0.21.1，对应 requirements
  # 的 transformers>=4.51,<5 与 tokenizers>=0.21,<0.22（2026 派生的 5.x/0.23
  # 不满足）。同样只复用其 src/派生，构建仍在本 scope 内。
  ps2025 = (inputs.nixpkgs-multiverse.multiverse.${system}.at "2025-06-01").python312Packages;

  # 2026-01 快照：ml-dtypes 0.5.4，nixpkgs(2026-10) 已升至 0.6.0（运行期要求
  # numpy>=2，与 requirements 的 numpy<2 冲突）。仅复用其派生定义/src，
  # 构建与依赖解析仍在本 scope（numpy 1.26.4）内进行。
  ps2026 = inputs.nixpkgs-multiverse.multiverse.${system}.at "2026-01-01";

  snapshots = {
    inherit
      multiverse2024
      multiversePs
      ps2025
      ps2026
      ;
  };

  args = {
    inherit
      lib
      pkgs
      inputs
      snapshots
      acceleration
      torchCudaPackages
      ;
  };

  # 各覆写拆为一包一文件；按需读取 snapshots 内的快照派生。
  pins = [
    ./pins/torch.nix
    ./pins/ml-dtypes.nix
    ./pins/scipy.nix
    ./pins/llvmlite.nix
    ./pins/numba.nix
    ./pins/scikit-learn.nix
    ./pins/librosa.nix
    ./pins/umap-learn.nix
    ./pins/numcodecs.nix
    ./pins/pyerfa.nix
    ./pins/scikit-image.nix
    ./pins/tokenizers.nix
    ./pins/transformers.nix
    ./pins/huggingface-hub.nix
    ./pins/peft.nix
    ./pins/torchmetrics.nix
    ./pins/ctranslate2.nix
    ./pins/faster-whisper.nix
    ./pins/anyio.nix
    ./pins/watchfiles.nix
    ./pins/accelerate.nix
    ./pins/diffusers.nix
    ./pins/tensorboardx.nix
    ./pins/narwhals.nix
    ./pins/httpx2.nix
    ./pins/imageio.nix
    ./pins/gradio.nix
    # gradio 4.x 需要 request-first 之前的 starlette 模板 API，与 nixpkgs(2026)
    # 的 starlette 1.x / fastapi 0.14x 不兼容，一并降到 multiverse 2024-11-01 同代。
    ./pins/fastapi.nix
    ./pins/starlette.nix
  ];
in
# 用同一组 final/prev 求值每个 pin 再合并，等价于原先的单一 overlay
# （不使用 composeExtensions，以免改变 prev 语义）。
# 注意：`//` 合并下同名属性会静默后者覆盖，新增 pin 时请确保属性名不重复。
final: prev: lib.foldl' (acc: f: acc // f) { } (map (f: (import f args) final prev) pins)
