class Openagent < Formula
  desc "Open-source agentic coding CLI — multi-provider, token-efficient, extensible"
  homepage "https://github.com/openagent-cli/openagent"
  url "https://github.com/openagent-cli/openagent/archive/refs/tags/v0.1.0.tar.gz"
  sha256 "PLACEHOLDER"
  license "Apache-2.0"

  depends_on "node@20"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  def post_install
    ohai "OpenAgent installed! Run 'openagent' to get started."
  end

  test do
    assert_match "0.1.0", shell_output("#{bin}/openagent --version")
  end
end
