{
  snapshots,
  ...
}:
final: prev: {
  # requirements.txt 的版本约束：transformers>=4.51,<5、peft、torchmetrics、
  # ctranslate2 4.x。注意：
  #   - transformers 用 ps2025（4.52.4）；且必须整体替换 dependencies，
  #     否则继承 2026 派生的 huggingface-hub 1.x（4.x 需 <1.0）与
  #     tokenizers 0.23（4.5x 需 >=0.21,<0.22），运行期 import 会失败。
  #   - tokenizers 降级到 ps2025 的 0.21.1（4.52 要求 >=0.21,<0.22），
  #     但在本 scope 内重编（src/cargoDeps 取 ps2025）以保证
  #     pythonModule 一致。0.21.1 内置的 oniguruma 在 gcc 16 下因
  #     -Wincompatible-pointer-types 默认为 error 而编译失败，用
  #     CFLAGS 把它降级回 warning。
  #   - peft/torchmetrics/ctranslate2 src 复用 multiverse 2024-11-01
  #     （同代版本，互相兼容）。
  tokenizers = prev.tokenizers.overridePythonAttrs (old: {
    version = "0.21.1";
    src = snapshots.ps2025.tokenizers.src;
    cargoDeps = snapshots.ps2025.tokenizers.cargoDeps;
    # 0.21.1 的 install_requires 是 huggingface-hub<1.0。
    dependencies = [ final."huggingface-hub_0" ];
    # 0.23.2 的 postUnpack/postPatch 针对其测试数据布局，0.21.1
    # 不同且我们关闭测试，置空并去掉测试输入。
    postUnpack = "";
    postPatch = "";
    nativeCheckInputs = [ ];
    doCheck = false;
    env = (old.env or { }) // {
      # gcc 16 默认 C23：`int (*)()` 等价 `int (*)(void)`，且
      # incompatible-pointer-types 成为 error；oniguruma 6.9 依赖
      # 旧的 K&R 函数指针写法。用 gnu17 标准并降级相关诊断。
      NIX_CFLAGS_COMPILE = "-std=gnu17 -Wno-error=incompatible-pointer-types -Wno-error=int-conversion -Wno-error=implicit-function-declaration";
    };
  });
}
