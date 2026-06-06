import { execFile } from "child_process";
import { promisify } from "util";

const exec = promisify(execFile);

export class WorktreeManager {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? process.cwd();
  }

  async create(name: string): Promise<{ path: string; branch: string }> {
    const branch = `worktree/${name}`;
    const path = `${this.baseDir}-wt-${name}`;

    await exec("git", ["worktree", "add", path, "-b", branch], {
      cwd: this.baseDir,
    });

    return { path, branch };
  }

  async remove(name: string): Promise<void> {
    const path = `${this.baseDir}-wt-${name}`;
    const branch = `worktree/${name}`;

    await exec("git", ["worktree", "remove", path, "--force"], {
      cwd: this.baseDir,
    });
    await exec("git", ["branch", "-D", branch], { cwd: this.baseDir });
  }

  async list(): Promise<Array<{ name: string; path: string; branch: string }>> {
    const { stdout } = await exec("git", ["worktree", "list", "--porcelain"], {
      cwd: this.baseDir,
    });

    const entries: Array<{ name: string; path: string; branch: string }> = [];
    const blocks = stdout.trim().split("\n\n");

    for (const block of blocks) {
      const lines = block.split("\n");
      let wtPath = "";
      let branch = "";

      for (const line of lines) {
        if (line.startsWith("worktree ")) wtPath = line.slice(9);
        if (line.startsWith("branch refs/heads/"))
          branch = line.slice(18);
      }

      if (branch.startsWith("worktree/")) {
        entries.push({
          name: branch.slice(9),
          path: wtPath,
          branch,
        });
      }
    }

    return entries;
  }
}
