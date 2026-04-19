  # Security Policy                                                                                                                                                                                            
                             
  OpenAgent is an agentic coding CLI that can read/write files, execute shell commands, make network requests, and run external tools (MCP servers, local runtimes). We take the security of this tool — and of
   the credentials it handles — seriously.                                                                                                                                                                     
                                                                                                                                                                                                               
  ## Reporting a Vulnerability                                                                                                                                                                                 
                                                                                                                                                                                                               
  **Please do not report security issues in public GitHub issues.**

  Report vulnerabilities privately through one of the following:                                                                                                                                               
  
  - **Preferred:** [GitHub Security Advisories](https://github.com/ask-sol/openagent/security/advisories/new) — click "Report a vulnerability" on the Security tab.                                            
                                                                                                                                                                                                               
  Please include:                                                                                                                                                                                              
                                                                                                                                                                                                               
  - A clear description of the issue and its impact.                                                                                                                                                           
  - Steps to reproduce (minimal proof-of-concept, if possible).
  - The version of OpenAgent (`openagent --version`), your OS, and the provider(s) involved.                                                                                                                   
  - Any relevant logs, with secrets redacted.                                                                                                                                                                  
                                                                                                                                                                                                               
  **What to expect:**                                                                                                                                                                                          
                                                                                                                                                                                                               
  - Acknowledgement within **72 hours**.                                                                                                                                                                       
  - Initial triage and severity assessment within **7 days**.
  - A fix or mitigation target within **30 days** for high/critical issues.                                                                                                                                    
  - Credit in the release notes if you'd like it (opt-in).                                                                                                                                                                                                                                                                                 
                                                                                                                                                                                                               
  ## In Scope                                                                                                                                                                                                  
                  
  The following are considered security issues we want to hear about:                                                                                                                                          
   
  - **Command execution** — ways to make OpenAgent run shell commands outside the configured permission mode.                                                                                                  
  - **Prompt injection that escalates privileges** — e.g., injected web-search content causing the agent to exfiltrate files or run unintended commands. (Prompt injection itself is a known, inherent risk of
  LLM agents; we're most interested in cases that bypass our permission system.)                                                                                                                               
  - **Credential leakage** — bugs that expose API keys, OAuth tokens, or session history to unintended destinations (logs, network requests, other processes).
  - **Path traversal / arbitrary file access** — cases where file-tool boundaries (e.g., working directory, `.gitignore` respect) are bypassed.                                                                
  - **Supply chain** — issues in our Homebrew formula, `install-remote.sh`, or npm distribution that could compromise a clean install.                                                                         
  - **MCP server handling** — bugs in how OpenAgent loads, validates, or isolates MCP servers.                                                                                                                 
  - **Auto-update** — bugs in `--upgrade` that could fetch or execute unintended code.                                                                                                                         
                                                                                                                                                                                                               
  ## Out of Scope                                                                                                                                                                                              
                                                                                                                                                                                                               
  The following are not tracked as OpenAgent vulnerabilities (please report them to the appropriate project):                                                                                                  
   
  - Vulnerabilities in upstream AI providers (Anthropic, OpenAI, Gemini, Ollama, LM Studio, MLX, etc.).                                                                                                        
  - Vulnerabilities in MCP servers you've installed yourself — those are third-party code.
  - Vulnerabilities in Node.js, Bun, Homebrew, or other runtime dependencies (report to their maintainers).                                                                                                    
  - The fact that **unrestricted mode** can execute arbitrary commands. This is documented behavior and requires explicit opt-in per directory.                                                                
  - Jailbreaks or prompt injections that only affect the quality of model responses without escalating beyond the agent's already-authorized actions.                                                          
                                                                                                                                                                                                               
  ## Trust Model                                                                                                                                                                                               
                                                                                                                                                                                                               
  OpenAgent is designed around an explicit, user-granted trust model:                                                                                                                                          
   
  - **Standard mode** (default) — prompts before file writes and command execution.                                                                                                                            
  - **Cautious mode** — prompts before every tool call.
  - **Unrestricted mode** — no prompts. **Only use this in sandboxed or throwaway environments.** The directory-level confirmation prompt on first use is a safety feature and should not be bypassed.         
                                                                                                                                                                                                               
  API keys and OAuth tokens are stored in `~/.openagent/` with user-only permissions. We do not transmit them anywhere except the provider's own endpoints. If you find evidence to the contrary, that's an    
  in-scope vulnerability.                                                                                                                                                                                      
                                                                                                                                                                                                               
  ## Responsible Disclosure

  We ask that you:

  - Give us a reasonable window (at least 30 days, or longer for complex issues) to ship a fix before public disclosure.                                                                                       
  - Avoid accessing, modifying, or destroying data that is not yours.
  - Avoid running automated scanners against our infrastructure.                                                                                                                                               
                                                                                                                                                                                                               
  Thank you for helping keep OpenAgent and its users safe.             
