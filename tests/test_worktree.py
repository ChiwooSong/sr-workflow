import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest

HELPER = Path(__file__).resolve().parents[1] / "sr-workflow/scripts/check_worktree.py"


class WorktreeTest(unittest.TestCase):
    def test_checkout_and_cli_baseline(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            repo, work = root / "demo", root / "issue 7"
            repo.mkdir()

            def git(*args):
                subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True)

            git("init", "-b", "main")
            (repo / "double.py").write_text("import sys\nprint(2 * int(sys.argv[1]))\n")
            git("add", "double.py")
            git("-c", "user.name=Fixture", "-c", "user.email=dev@example.invalid",
                "-c", "commit.gpgsign=false", "commit", "-m", "fixture")
            git("worktree", "add", "-b", "sr-7", str(work))
            for cwd, branch, code in [(work, "sr-7", 0), (repo, "sr-7", 1),
                                      (work, "main", 1), (root, "sr-7", 2)]:
                check = subprocess.run([sys.executable, str(HELPER), str(work), branch],
                                       cwd=cwd, capture_output=True, text=True)
                self.assertEqual(check.returncode, code)
                if code != 2:
                    self.assertEqual(json.loads(check.stdout)["matches"], code == 0)
            baseline = ("import subprocess, sys\n"
                        "value = subprocess.check_output([sys.executable, 'double.py', '7'], text=True).strip()\n"
                        "assert value == '14', value\n")
            probe = work / "baseline.py"
            for script, code in [(baseline.replace("'14'", "'15'"), 1), (baseline, 0)]:
                probe.write_text(script)
                result = subprocess.run([sys.executable, str(probe)], cwd=work, capture_output=True)
                self.assertEqual(result.returncode, code)
                if code:
                    self.assertIn(b"AssertionError: 14", result.stderr)
