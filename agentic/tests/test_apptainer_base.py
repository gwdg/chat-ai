"""Tests for Task 2.1: Base Apptainer Image.

Phase 1 tests are functional (mock httpx, exercise the FastAPI endpoints).
Phase 2 introduces non-Python build artifacts — Apptainer recipes and
shell scripts — so this module establishes a precedent for *static*
artifact testing: parse the file as text and assert required structure
and content. No apptainer binary required, no build needed, no network.

The acceptance criteria that **do** require a built ``.sif``
(``apptainer run``, ``python3.11 --version``, etc.) are covered by the
``agentic/containers/base/test_image.sh`` smoke script which the cluster
operator runs after building.
"""

from __future__ import annotations

import os
import re
import stat
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
CONTAINERS_DIR = REPO_ROOT / "agentic" / "containers"
BASE_DIR = CONTAINERS_DIR / "base"
DEF_PATH = BASE_DIR / "Apptainer.def"
BUILD_SCRIPT_PATH = BASE_DIR / "build_image.sh"
TEST_SCRIPT_PATH = BASE_DIR / "test_image.sh"
BASE_README_PATH = BASE_DIR / "README.md"
INDEX_README_PATH = CONTAINERS_DIR / "README.md"
GITIGNORE_PATH = CONTAINERS_DIR / ".gitignore"


@pytest.fixture(scope="module")
def def_text() -> str:
    return DEF_PATH.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def build_script_text() -> str:
    return BUILD_SCRIPT_PATH.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def test_script_text() -> str:
    return TEST_SCRIPT_PATH.read_text(encoding="utf-8")


def _section(text: str, header: str) -> str:
    """Return the body of an Apptainer.def section (e.g. ``%post``).

    Sections start at the header line and run to the next ``%foo`` header
    or EOF. The header itself is excluded.
    """
    pattern = re.compile(
        rf"^{re.escape(header)}\b.*?(?=^%[a-z]+\b|\Z)",
        re.DOTALL | re.MULTILINE,
    )
    m = pattern.search(text)
    return m.group(0) if m else ""


# --------------------------------------------------------------------------- #
# Layout                                                                      #
# --------------------------------------------------------------------------- #

def test_required_files_exist():
    for p in (DEF_PATH, BUILD_SCRIPT_PATH, TEST_SCRIPT_PATH,
              BASE_README_PATH, INDEX_README_PATH, GITIGNORE_PATH):
        assert p.is_file(), f"missing required file: {p}"


def test_def_size_sane():
    """Guard against accidentally committing a binary or a runaway recipe."""
    size = DEF_PATH.stat().st_size
    assert 1_000 < size < 50_000, (
        f"Apptainer.def is {size} bytes (expected ~1-50 KB; "
        f"binary or runaway commit?)"
    )


# --------------------------------------------------------------------------- #
# Apptainer.def — header                                                      #
# --------------------------------------------------------------------------- #

def test_def_bootstrap_is_docker(def_text: str):
    assert re.search(r"^Bootstrap:\s*docker\b", def_text, re.MULTILINE), (
        "Apptainer.def must declare `Bootstrap: docker`"
    )


def test_def_from_is_ubuntu_2204(def_text: str):
    assert re.search(r"^From:\s*ubuntu:22\.04\b", def_text, re.MULTILINE), (
        "Apptainer.def must declare `From: ubuntu:22.04`"
    )


# --------------------------------------------------------------------------- #
# Apptainer.def — %post (the bulk of the work)                                #
# --------------------------------------------------------------------------- #

REQUIRED_POST_TOKENS = (
    # Python 3.11 path
    "deadsnakes",
    "python3.11",
    # Node 20 path
    "setup_20.x",
    "nodejs",
    # Browser
    "google-chrome-stable",
    # Core tooling
    "jq",
    "git",
    "curl",
    "tini",
    # Chrome runtime libs (representative subset — if any of these go
    # missing, Chrome headless will fail to start at run time)
    "libnss3",
    "libasound2",
    "libgbm1",
    "libxkbcommon0",
    "fonts-liberation",
    # Hardening / cleanup
    "--no-install-recommends",
)


@pytest.mark.parametrize("token", REQUIRED_POST_TOKENS)
def test_def_post_contains_token(def_text: str, token: str):
    post = _section(def_text, "%post")
    assert post, "Apptainer.def has no %post section"
    assert token in post, (
        f"%post must reference {token!r} (it does not). "
        f"Removing this likely breaks an acceptance criterion or runtime."
    )


def test_def_post_creates_workspace_mount(def_text: str):
    post = _section(def_text, "%post")
    assert re.search(r"mkdir\s+-p\s+/workspace", post), (
        "%post must `mkdir -p /workspace`"
    )
    assert re.search(r"chmod\s+1777\s+/workspace", post), (
        "%post must `chmod 1777 /workspace` so the UID-mapped runtime user "
        "can write into the bind-mounted scratch space"
    )


def test_def_post_creates_home_user_mount(def_text: str):
    post = _section(def_text, "%post")
    assert re.search(r"mkdir\s+-p\s+/home/user", post), (
        "%post must `mkdir -p /home/user` (fallback when --bind not provided)"
    )


def test_def_post_uses_strict_shell(def_text: str):
    post = _section(def_text, "%post")
    assert re.search(r"^\s*set\s+-e", post, re.MULTILINE), (
        "%post must `set -e` (or -eux) so a failed apt-get aborts the build"
    )


# --------------------------------------------------------------------------- #
# Apptainer.def — %environment (negative tests)                               #
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize(
    "var", ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY",
            "http_proxy", "https_proxy", "no_proxy"],
)
def test_def_environment_does_not_hardcode_proxy(def_text: str, var: str):
    """Proxy is per-session; the broker injects it via APPTAINERENV_*."""
    env = _section(def_text, "%environment")
    assert env, "Apptainer.def has no %environment section"
    assert not re.search(rf"^\s*export\s+{var}=", env, re.MULTILINE), (
        f"%environment must not hardcode {var}; the broker plumbs proxy "
        f"per-session via APPTAINERENV_{var.upper()}."
    )


def test_def_environment_sets_locale_and_python_flags(def_text: str):
    env = _section(def_text, "%environment")
    assert "LANG=" in env, "%environment must export LANG"
    assert "PYTHONUNBUFFERED=1" in env, (
        "%environment must export PYTHONUNBUFFERED=1 for sane log streaming"
    )


# --------------------------------------------------------------------------- #
# Apptainer.def — %runscript (acceptance: `apptainer run --help`)             #
# --------------------------------------------------------------------------- #

def test_def_runscript_help_branch_exits_zero(def_text: str):
    """Acceptance criterion: `apptainer run Image.sif --help` exits 0."""
    runscript = _section(def_text, "%runscript")
    assert runscript, "Apptainer.def has no %runscript section"
    assert "--help" in runscript, "%runscript must handle --help"
    # The if-branch that prints help must exit 0.
    assert re.search(r"exit\s+0", runscript), (
        "%runscript --help/-h/no-arg branch must `exit 0`"
    )
    # And forward unknown args to a real command.
    assert re.search(r'exec\s+"\$@"', runscript), (
        "%runscript must `exec \"$@\"` for non-help invocations"
    )


# --------------------------------------------------------------------------- #
# Apptainer.def — %labels                                                     #
# --------------------------------------------------------------------------- #

REQUIRED_LABELS = {
    "org.chat-ai.image": "base",
    "org.chat-ai.task": "2.1",
    "org.chat-ai.python": "3.11",
    "org.chat-ai.node": "20",
    "org.chat-ai.browser": "google-chrome-stable",
}


@pytest.mark.parametrize("key,value", list(REQUIRED_LABELS.items()))
def test_def_required_labels_present(def_text: str, key: str, value: str):
    labels = _section(def_text, "%labels")
    assert labels, "Apptainer.def has no %labels section"
    pattern = rf"^\s*{re.escape(key)}\s+{re.escape(value)}\s*$"
    assert re.search(pattern, labels, re.MULTILINE), (
        f"%labels must contain `{key} {value}`"
    )


# --------------------------------------------------------------------------- #
# build_image.sh                                                              #
# --------------------------------------------------------------------------- #

def test_build_script_is_executable():
    mode = BUILD_SCRIPT_PATH.stat().st_mode
    assert mode & stat.S_IXUSR, "build_image.sh must be user-executable"
    assert os.access(BUILD_SCRIPT_PATH, os.X_OK), (
        "build_image.sh must satisfy os.access(X_OK)"
    )


def test_build_script_shebang_is_posix_sh(build_script_text: str):
    first_line = build_script_text.splitlines()[0]
    assert first_line == "#!/bin/sh", (
        f"build_image.sh shebang must be `#!/bin/sh` (got {first_line!r}); "
        f"don't add bashisms"
    )


def test_build_script_uses_strict_mode(build_script_text: str):
    assert re.search(r"^\s*set\s+-e", build_script_text, re.MULTILINE), (
        "build_image.sh must `set -e` (or -eu) early"
    )


def test_build_script_checks_apptainer_present(build_script_text: str):
    assert "command -v apptainer" in build_script_text, (
        "build_image.sh must `command -v apptainer` pre-flight"
    )


@pytest.mark.parametrize(
    "flag", ["--fakeroot", "--remote", "--force", "--output", "--help"],
)
def test_build_script_supports_flag(build_script_text: str, flag: str):
    assert flag in build_script_text, (
        f"build_image.sh must accept the {flag} flag (per task design)"
    )


def test_build_script_enforces_size_budget(build_script_text: str):
    # 5 GB ceiling per acceptance criterion — must appear as a numeric
    # literal somewhere (5368709120 bytes or "5 GB" in messaging).
    assert "5368709120" in build_script_text, (
        "build_image.sh must enforce the 5 GB size budget "
        "(expected literal 5368709120 = 5*1024^3)"
    )
    assert re.search(r"exit\s+4", build_script_text), (
        "build_image.sh must `exit 4` when the size budget is exceeded"
    )


def test_build_script_propagates_metadata_to_post(build_script_text: str):
    assert "APPTAINERENV_BUILD_SHA" in build_script_text, (
        "build_image.sh must set APPTAINERENV_BUILD_SHA so /etc/chat-ai-image-info "
        "is stamped during %post"
    )
    assert "APPTAINERENV_BUILD_DATE" in build_script_text, (
        "build_image.sh must set APPTAINERENV_BUILD_DATE"
    )


# --------------------------------------------------------------------------- #
# test_image.sh                                                               #
# --------------------------------------------------------------------------- #

def test_test_image_script_is_executable():
    assert os.access(TEST_SCRIPT_PATH, os.X_OK), (
        "test_image.sh must be executable"
    )


def test_test_image_script_shebang_is_posix_sh(test_script_text: str):
    first_line = test_script_text.splitlines()[0]
    assert first_line == "#!/bin/sh"


def test_test_image_script_exercises_acceptance_criteria(test_script_text: str):
    """Each Task 2.1 acceptance criterion must be probed by the smoke."""
    expected_probes = (
        "python3.11 --version",
        "node --version",
        "google-chrome --version",
        "jq --version",
        "git --version",
        "curl --version",
        "id -u",
        "/workspace",
    )
    for probe in expected_probes:
        assert probe in test_script_text, (
            f"test_image.sh must exercise {probe!r} (acceptance criterion)"
        )


# --------------------------------------------------------------------------- #
# Index README + .gitignore                                                   #
# --------------------------------------------------------------------------- #

def test_gitignore_excludes_built_artifacts():
    text = GITIGNORE_PATH.read_text(encoding="utf-8")
    for pattern in ("*.sif", "*.log"):
        assert pattern in text, (
            f"agentic/containers/.gitignore must exclude {pattern} "
            f"(don't commit build artifacts)"
        )


def test_index_readme_lists_base():
    text = INDEX_README_PATH.read_text(encoding="utf-8")
    assert "base/" in text or "base/](base/)" in text, (
        "agentic/containers/README.md must reference base/"
    )
