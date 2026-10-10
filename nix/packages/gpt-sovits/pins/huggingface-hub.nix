{
  ...
}:
final: prev: {
  # 全 scope 统一 huggingface-hub 到 0.36.2（nixpkgs 现成的
  # `huggingface-hub_0`）：requirements 要求 huggingface_hub<1.0
  # （transformers 4.52 / tokenizers 0.21 的 install_requires 上限），
  # 而 nixpkgs 2026-10 默认 1.30.0。若只在 transformers/tokenizers
  # 局部替换，会与 accelerate/diffusers 等继承的 1.x 在 peft 等闭包内
  # 形成重复包（python-catch-conflicts-hook 直接报错）。gradio 6.x 的
  # 元数据要求 >=1.16，故对其单独关闭 runtime deps 校验（gradio 为已
  # 记录 deferred 项，仅要求 import 成功）。
  huggingface-hub = final."huggingface-hub_0";
}
