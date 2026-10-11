# Static catalogue of the GPT-SoVITS pretrained models.
#
# Pure data + tiny constructors: this file deliberately depends only on `lib`
# so it can be imported and evaluated without a `pkgs` instance. The consumer
# (`nixosModules/default.nix`) turns each entry into a derivation.
#
# Every entry describes ONE file or ONE directory of files below the runtime data
# root: `models/pretrained_models` for the TTS weights. The
# hashes are
# the sha256 of the file contents, taken from the HuggingFace LFS `oid`
# (`https://huggingface.co/api/models/<repo>/tree/main?recursive=1`) or, for the
# few tiny non-LFS JSON files, computed by hashing the file itself. See
# `.slim/deepwork/gpt-sovits-wsl-c8i/model-catalog.md` for provenance.
#
# SCOPE: this catalogue covers only the inference/fine-tuning weights of the
# TTS models themselves (BERT/HuBERT/G2PW/fast-langdetect + per-version s1/s2G/
# s2D/vocoder/BigVGAN/sv). It deliberately does NOT cover the auxiliary
# toolboxes (ASR / faster-whisper / uvr5 / nltk_data / open_jtalk), whose
# runtime downloads the inlined download guards turn into "local path missing -> hard error".
# Those stay offline-safe (no network) but non-functional until the user
# supplies their data locally.
{ lib }:
let
  pretrainedDir = "models/pretrained_models";

  # A single downloadable file. `name` is the link name below `installPath`.
  # `versions` lists the versions that need it ([] with `mandatory = true` for
  # the always-on base models). `trainingOnly` marks weights only needed when
  # fine-tuning (the s2D discriminators; NOT the eres2net speaker model, which
  # v2Pro/v2ProPlus also need at inference time). `repo` selects the mirror
  # root (see `repos` below): "lj1995" (default) or "xxxxrt".
  file =
    {
      name,
      hfPath ? name,
      installPath ? pretrainedDir,
      hash,
      versions ? [ ],
      trainingOnly ? false,
      msPath ? hfPath,
      mandatory ? false,
      repo ? "lj1995",
    }:
    {
      kind = "file";
      inherit
        name
        hfPath
        installPath
        hash
        versions
        trainingOnly
        msPath
        mandatory
        repo
        ;
    };

  # A file inside a `dir` bundle. `versions`/`trainingOnly` are evaluated per
  # file so a single directory can mix always-on and training-only files.
  bundleFile =
    {
      name ? baseNameOf (toString hfPath),
      hfPath,
      hash,
      versions ? [ ],
      trainingOnly ? false,
      msPath ? hfPath,
    }:
    {
      inherit
        name
        hfPath
        hash
        versions
        trainingOnly
        msPath
        ;
    };

  # A bundle of files assembled into ONE directory derivation (the directory is
  # what gets linked, e.g. a HuggingFace model dir consumed by `from_pretrained`).
  dir =
    {
      name,
      installPath ? pretrainedDir,
      files,
      versions ? [ ],
      mandatory ? false,
    }:
    {
      kind = "dir";
      inherit
        name
        installPath
        files
        versions
        mandatory
        ;
    };
  # Per-file mirror roots, keyed by upstream repository.
  #  * `lj1995/GPT-SoVITS` is the upstream HF repo whose root IS the contents
  #    of `pretrained_models`. Its ModelScope mirror is
  #    `XXXXRT/GPT-SoVITS-Pretrained` under `pretrained_models/`, which LACKS
  #    the v5 weights (hence the v5 fallback in `default.nix`).
  #  * `XXXXRT/GPT-SoVITS-Pretrained` holds the packed/extra artifacts that
  #    `lj1995` does not (G2PWModel.zip, `fast_langdetect/lid.176.bin`, ...).
  #    Its HF tree keeps everything under a `pretrained_models/` prefix, so
  #    entries select it with `repo = "xxxxrt"` and pass an explicit `msPath`.
  repos = {
    lj1995 = {
      huggingface = "https://huggingface.co/lj1995/GPT-SoVITS/resolve/main";
      "hf-mirror" = "https://hf-mirror.com/lj1995/GPT-SoVITS/resolve/main";
      modelscope = "https://www.modelscope.cn/models/XXXXRT/GPT-SoVITS-Pretrained/resolve/master/pretrained_models";
    };
    xxxxrt = {
      huggingface = "https://huggingface.co/XXXXRT/GPT-SoVITS-Pretrained/resolve/main";
      "hf-mirror" = "https://hf-mirror.com/XXXXRT/GPT-SoVITS-Pretrained/resolve/main";
      modelscope = "https://www.modelscope.cn/models/XXXXRT/GPT-SoVITS-Pretrained/resolve/master/pretrained_models";
    };
  };
in
{
  inherit pretrainedDir repos;

  # G2PWModel.zip is a repo-root artifact (not below `pretrained_models`); its
  # archive top-level is a single `G2PWModel/` directory.
  g2pwZip = {
    hf = "https://huggingface.co/XXXXRT/GPT-SoVITS-Pretrained/resolve/main/G2PWModel.zip";
    hfMirror = "https://hf-mirror.com/XXXXRT/GPT-SoVITS-Pretrained/resolve/main/G2PWModel.zip";
    modelscope = "https://www.modelscope.cn/models/XXXXRT/GPT-SoVITS-Pretrained/resolve/master/G2PWModel.zip";
    hash = "sha256-Rikr4DdKSTCAaSM81cFHrkxBgGVY5HgaJGejGk2Amdo=";
  };

  entries = [
    # --------------------------------------------------------------------- #
    # Mandatory base models (linked unconditionally, no version switch).     #
    # --------------------------------------------------------------------- #
    (dir {
      name = "chinese-roberta-wwm-ext-large";
      mandatory = true;
      files = [
        (bundleFile {
          hfPath = "chinese-roberta-wwm-ext-large/config.json";
          hash = "sha256-PVfeL9foDQ5cj/GU8Lu2uqEN9+Q/wmKgzHEpiniwo+U=";
        })
        (bundleFile {
          hfPath = "chinese-roberta-wwm-ext-large/pytorch_model.bin";
          hash = "sha256-5TppOsxZrOJR0UPQaAlq4Ne3nksbUD+oTJ3PV2RIwdg=";
        })
        (bundleFile {
          hfPath = "chinese-roberta-wwm-ext-large/tokenizer.json";
          hash = "sha256-FzeWlWgg6ie9FPdr8oFiYH/0JUgH4pSCU+tbRvW7ZDs=";
        })
      ];
    })
    (dir {
      name = "chinese-hubert-base";
      mandatory = true;
      files = [
        (bundleFile {
          hfPath = "chinese-hubert-base/config.json";
          hash = "sha256-w+UGChJ34PB4zGvp2kUopgXbpuzpMBiYH+LIIOXHsQM=";
        })
        (bundleFile {
          hfPath = "chinese-hubert-base/preprocessor_config.json";
          hash = "sha256-3NaEEk0GcilHk51B6mrljb8QloxgoRop8j3cYCxkops=";
        })
        (bundleFile {
          hfPath = "chinese-hubert-base/pytorch_model.bin";
          hash = "sha256-JBZPEpxmSZ0TRuKqVfGDJQwiMWHsJ3DA2j07CM9DLTw=";
        })
      ];
    })
    # fast_langdetect's language-ID model. `langsegmenter.py` points its cache
    # dir at `pretrained_models/fast_langdetect`; without this file
    # `fast_langdetect.load_with_download` would fetch it over plain HTTP
    # (`dl.fbaipublicfiles.com`), which `HF_HUB_OFFLINE` does not block.
    (file {
      name = "lid.176.bin";
      hfPath = "pretrained_models/fast_langdetect/lid.176.bin";
      msPath = "fast_langdetect/lid.176.bin";
      installPath = "models/pretrained_models/fast_langdetect";
      hash = "sha256-fmnsVFG8JhzHhE5J5HkqhdfwnAZ4nsgA/EpErsNidk4=";
      repo = "xxxxrt";
      mandatory = true;
    })

    # --------------------------------------------------------------------- #
    # v1                                                                    #
    # --------------------------------------------------------------------- #
    (file {
      name = "s1bert25hz-2kh-longer-epoch=68e-step=50232.ckpt";
      hash = "sha256-scHhfpyZVHqJOI9yBIzW4bQbWhixcOhqRt/eAyTWPrE=";
      versions = [ "v1" ];
    })
    (file {
      name = "s2G488k.pth";
      hash = "sha256-AgoBTh4B5VDlEPL2H65eX1tqq0DxXCLx8S9yTfUH6DU=";
      versions = [ "v1" ];
    })
    (file {
      name = "s2D488k.pth";
      hash = "sha256-/FecHbPB4htyEAHPmdelhCFCgN8ZsALiALYwo0+gbrg=";
      versions = [ "v1" ];
      trainingOnly = true;
    })

    # --------------------------------------------------------------------- #
    # v2                                                                    #
    # --------------------------------------------------------------------- #
    (dir {
      name = "gsv-v2final-pretrained";
      versions = [ "v2" ];
      files = [
        (bundleFile {
          hfPath = "gsv-v2final-pretrained/s1bert25hz-5kh-longer-epoch=12-step=369668.ckpt";
          hash = "sha256-cy+U5jsUgGbiTH+dJjfzN0CD5jdjXwf722ld7iDdvh8=";
        })
        (bundleFile {
          hfPath = "gsv-v2final-pretrained/s2G2333k.pth";
          hash = "sha256-kk/cyqPFdL8TnCXJdZqh7Ts/meGafFKe6ZbCvBdmNpU=";
        })
        (bundleFile {
          hfPath = "gsv-v2final-pretrained/s2D2333k.pth";
          hash = "sha256-iuf+jdjI8ucY3jWeAO2siLDHGrL9ELB61MxFBw64qDY=";
          trainingOnly = true;
        })
      ];
    })

    # --------------------------------------------------------------------- #
    # v3 (shares s1v3.ckpt; vocoder is the BigVGAN directory)               #
    # --------------------------------------------------------------------- #
    (file {
      name = "s1v3.ckpt";
      hash = "sha256-hxM0FIYOoU/2YgxIOj217Qe0S+QuLD/NrWVSOnKadFo=";
      versions = [
        "v3"
        "v4"
        "v5dev"
        "v5turbo"
        "v2Pro"
        "v2ProPlus"
      ];
    })
    (file {
      name = "s2Gv3.pth";
      hash = "sha256-8zq7GSAHbZiOFxHV9BtcnG1/kldbSs8K1PrmpOvwzxk=";
      versions = [ "v3" ];
    })
    (dir {
      name = "models--nvidia--bigvgan_v2_24khz_100band_256x";
      versions = [ "v3" ];
      files = [
        (bundleFile {
          hfPath = "models--nvidia--bigvgan_v2_24khz_100band_256x/bigvgan_generator.pt";
          hash = "sha256-b5xXFVUMnQ8RFZzriTVjjaWusZ4n0eY2d2Mt8JXjdvU=";
        })
        (bundleFile {
          hfPath = "models--nvidia--bigvgan_v2_24khz_100band_256x/config.json";
          hash = "sha256-134sllg8oilqwRKlbsfMa9XaS/doHO/xhEi+3E/PZRI=";
        })
      ];
    })

    # --------------------------------------------------------------------- #
    # v4                                                                    #
    # --------------------------------------------------------------------- #
    (dir {
      name = "gsv-v4-pretrained";
      versions = [ "v4" ];
      files = [
        (bundleFile {
          hfPath = "gsv-v4-pretrained/s2Gv4.pth";
          hash = "sha256-kG/iL0jD4Dejid8pHU0yqUFOFdu4+WKGQ+g6rO0QnqQ=";
        })
        (bundleFile {
          hfPath = "gsv-v4-pretrained/vocoder.pth";
          hash = "sha256-TWEZE997EtSeiXbJRFWNLQloFjZe38bDWp6Ftn3RTtk=";
        })
      ];
    })

    # --------------------------------------------------------------------- #
    # v5dev / v5turbo (share `vocoder.pth`)                                 #
    # --------------------------------------------------------------------- #
    (dir {
      name = "gsv-v5-pretrained";
      versions = [
        "v5dev"
        "v5turbo"
      ];
      files = [
        (bundleFile {
          hfPath = "gsv-v5-pretrained/s2Gv5dev.pth";
          hash = "sha256-FsEfxYipIppHkxahH8D1GAh+eXc/UnFmapCznVBGBAc=";
          versions = [ "v5dev" ];
        })
        (bundleFile {
          hfPath = "gsv-v5-pretrained/s2Gv5turbo.pth";
          hash = "sha256-KHsyoGt9SG9TA+xSBGiwco+wGqyLD12G/VRVyaHT4CI=";
          versions = [ "v5turbo" ];
        })
        (bundleFile {
          hfPath = "gsv-v5-pretrained/vocoder.pth";
          hash = "sha256-t1Q8gyIqohBbtO+1aEUIa8Xy7rphJD1yP/oGIFKzIh8=";
          versions = [
            "v5dev"
            "v5turbo"
          ];
        })
      ];
    })

    # --------------------------------------------------------------------- #
    # v2Pro / v2ProPlus (share s1v3.ckpt and the eres2net speaker model)     #
    # --------------------------------------------------------------------- #
    (dir {
      name = "v2Pro";
      versions = [
        "v2Pro"
        "v2ProPlus"
      ];
      files = [
        (bundleFile {
          hfPath = "v2Pro/s2Gv2Pro.pth";
          hash = "sha256-D46tgVI0Nl7fBFxthjcO1uT0QOgZW+d/8OpyaErUBqU=";
          versions = [ "v2Pro" ];
        })
        (bundleFile {
          hfPath = "v2Pro/s2Gv2ProPlus.pth";
          hash = "sha256-1Coiu79l+yu91FrWpmhBFWl320XHqr4KaZL/N42cfTs=";
          versions = [ "v2ProPlus" ];
        })
        (bundleFile {
          hfPath = "v2Pro/s2Dv2Pro.pth";
          hash = "sha256-JXp/Nq5J6f8IeQ0s09OYWSUwhSyrqBAZf4YG6ISlLFQ=";
          versions = [ "v2Pro" ];
          trainingOnly = true;
        })
        (bundleFile {
          hfPath = "v2Pro/s2Dv2ProPlus.pth";
          hash = "sha256-Y1zYS/b3+bjUHIjHEG+B14LHlMYfkxhFIU6gN7DFvvI=";
          versions = [ "v2ProPlus" ];
          trainingOnly = true;
        })
      ];
    })
    (dir {
      name = "sv";
      versions = [
        "v2Pro"
        "v2ProPlus"
      ];
      files = [
        (bundleFile {
          hfPath = "sv/pretrained_eres2netv2w24s4ep4.ckpt";
          hash = "sha256-T1oL9zxh60GxdOG7VOfuPIMjOJK+jgrx8YcCTo5YGjU=";
          versions = [
            "v2Pro"
            "v2ProPlus"
          ];
        })
      ];
    })
  ];
}
