{
  lib,
  config,
  ...
}:
{
  cuda = {
    type = "app";
    program = lib.getExe (config.packages.gpt-sovits.override { acceleration = "cuda"; });
    meta.description = "GPT-SoVITS WebUI (CUDA)";
  };
}
