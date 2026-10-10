{
  lib,
  pkgs,
  acceleration ? "cpu",
  torchCudaPackages ? pkgs.cudaPackages_13_3,
  ...
}:
final: prev:
let
  cuda = acceleration == "cuda";

  # 所有接收 cudaPackages 的属性必须传入同一份：nixpkgs 默认 cudaPackages 为
  # 12.9，而预编译 CUDA wheels 依赖 cuda-bindings>=13.0.3，故 GPU 分支固定
  # cudaPackages_13_3。
  pin = pkg: pkg.override { cudaPackages = torchCudaPackages; };
in
{
  # CPU 分支保持与原先逐字节一致（仅 cudaSupport = false，不再叠加 cudaPackages）。
  torch = if cuda then pin prev.torch-bin else prev.torch.override { cudaSupport = false; };
  triton = if cuda then pin prev.triton-bin else prev.triton.override { cudaSupport = false; };
}
// lib.optionalAttrs cuda {
  # GPU（WSL CUDA）分支：使用预编译 CUDA wheels。
  torchvision = pin prev.torchvision-bin;
  torchaudio = pin prev.torchaudio-bin;
  # 让按属性名解析这些包的对象也拿到同一 cudaPackages。
  torch-bin = pin prev.torch-bin;
  triton-bin = pin prev.triton-bin;
  torchvision-bin = pin prev.torchvision-bin;
  torchaudio-bin = pin prev.torchaudio-bin;
}
