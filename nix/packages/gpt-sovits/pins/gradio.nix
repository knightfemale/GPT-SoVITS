{
  snapshots,
  ...
}:
final: prev: {
  # requirements: gradio<5，故把 nixpkgs 2026 的 gradio 6.29.0 降到 4.44.1。
  # gradio 4.x 的 webui 资产随 PyPI wheel 一起发布，直接复用 multiverse
  # 2024-11-01 快照的 fetchPypi 配方（无需 pnpm 自建），运行期依赖仍在本
  # scope 内解析。gradio-client 必须同代降到 1.3.0：nixpkgs 2026 的 2.7.1
  # 以 `inherit (gradio) src` 从 gradio 源码树构建，无法搭配 4.x 的 wheel。
  #
  # 注意：gradio 的 passthru.sans-reverse-dependencies 内部调用
  # `gradio.override`（gradio-client 借此打破循环依赖），而
  # overridePythonAttrs 产出的结果会丢失 `.override`，导致求值报
  # "attribute 'override' missing"。这里显式补回原 `.override`。
  gradio =
    let
      drv =
        final.callPackage
          "${snapshots.multiverse2024.path}/pkgs/development/python-modules/gradio/default.nix"
          {
            inherit (final) gradio;
          };
    in
    (drv.overridePythonAttrs (old: {
      # 关闭测试：4.x 的 check 闭包会拉入 scikit-image/zarr/diffusers 等
      # numpy>=2 依赖，与 app 运行期无关。
      doCheck = false;
      doInstallCheck = false;
      nativeCheckInputs = [ ];
      disabledTests = [ ];
      disabledTestPaths = [ ];
      # multiverse 2024 的配方用已废弃的 pytestFlagsArray，本 scope 的
      # buildPythonPackage 会直接报错；置空即可。
      pytestFlagsArray = [ ];
      # 全 scope 把 huggingface-hub 统一到 0.36.2（<1.0，满足 4.x 的
      # >=0.19.3）；仍关闭 runtime deps 校验以与 gradio-client 保持一致。
      dontCheckRuntimeDeps = true;
    }))
    // {
      override = drv.override;
    };
  # gradio-client 1.3.0：纯运行期依赖，同样关闭测试与 runtime deps 校验。
  gradio-client =
    (final.callPackage
      "${snapshots.multiverse2024.path}/pkgs/development/python-modules/gradio/client.nix"
      {
        inherit (final) gradio;
      }
    ).overridePythonAttrs
      (old: {
        doCheck = false;
        nativeCheckInputs = [ ];
        disallowedReferences = [ ];
        # 同 gradio：旧配方使用已废弃的 pytestFlagsArray。
        pytestFlagsArray = [ ];
        dontCheckRuntimeDeps = true;
      });
}

# 其余 requirements 降级评估：
#   - gradio 4.44.1 + gradio-client 1.3.0：即本文件中的覆写。
#   - pydantic：requirements 写 `pydantic<=2.10.6`，本 scope 保留 nixpkgs
#     2026 的 2.13.4。gradio 4.44.1 元数据只要求 `pydantic>=2.0`，2.13.4
#     满足且 `import gradio` 通过；暂不降级（降 pydantic-core 为 Rust/
#     maturin 包，需重算 fetchCargoVendor 的 cargo hash，成本高）。
#   - huggingface-hub 1.x 与 gradio 4.x/transformers 4.x 的运行时兼容性
#     已由全 scope 统一到 0.36.2 核对通过。
