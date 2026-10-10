{
  lib,
  ...
}:
let
  # All Python dependencies packaged locally under nix/packages/<name>/.
  # They must be resolved with `final` (not `prev`) so the cross-dependencies
  # between them also hit the local overrides, e.g.
  #   funasr -> kaldiio / torch-complex
  #   split-lang -> fast-langdetect / budoux
  #   python-mecab-ko -> python-mecab-ko-dic
  #   g2p-en -> distance
  localPackageNames = [
    "numpy"
    "funasr"
    "g2p-en"
    "cn2an"
    "wordsegment"
    "ko-pron"
    "python-mecab-ko"
    "tojyutping"
    "fast-langdetect"
    "split-lang"
    "jieba-fast"
    "g2pk2"
    "kaldiio"
    "torch-complex"
    "proces"
    "distance"
    "budoux"
    "fasttext-predict"
    "robust-downloader"
    "python-mecab-ko-dic"
  ];
in
{
  inherit localPackageNames;

  overlay =
    final: prev:
    let
      local = name: final.callPackage ../${name} { };
    in
    lib.genAttrs localPackageNames local;
}
