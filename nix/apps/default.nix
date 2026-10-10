{
  lib,
  config,
  ...
}:
{
  default = {
    type = "app";
    program = lib.getExe config.packages.gpt-sovits;
    meta.description = "GPT-SoVITS WebUI (CPU)";
  };
}
