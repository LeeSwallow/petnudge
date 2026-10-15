#!/usr/bin/env sh
# Repository settings that cannot live in files: run once by the maintainer,
# with the GitHub CLI logged in. Renames the repository if it still has its
# old name, sets the description and topics, turns on Discussions and private
# security reports, syncs the labels, and makes the repository public.
#   scripts/repo-setup.sh [OWNER/REPO]   (default LeeSwallow/petnudge)
set -eu
repo="${1:-LeeSwallow/petnudge}"
owner="${repo%%/*}"
name="${repo#*/}"
old="$owner/Study-with-me-companion"

if ! gh repo view "$repo" >/dev/null 2>&1 && gh repo view "$old" >/dev/null 2>&1; then
	gh repo rename "$name" --repo "$old" --yes
	git remote set-url origin "git@github.com:$repo.git"
	echo "renamed $old -> $repo"
fi

gh repo edit "$repo" \
	--description "A pixel pet that lives on your desktop and nudges you: todos, pomodoro, and your coding agent (MCP). macOS · Windows · Linux." \
	--homepage "https://github.com/$repo" \
	--enable-issues \
	--enable-discussions \
	--enable-wiki=false \
	--delete-branch-on-merge \
	--add-topic desktop-pet --add-topic pixel-art --add-topic pomodoro --add-topic todo \
	--add-topic reminder --add-topic electron --add-topic mcp --add-topic claude-code \
	--add-topic codex --add-topic productivity --add-topic study --add-topic petdex
echo "description, topics, discussions: set"

# The labels: one list, in .github/labels.txt.
sh "$(dirname "$0")/sync-labels.sh" "$repo"

if [ "$(gh repo view "$repo" --json visibility -q .visibility)" != "PUBLIC" ]; then
	printf 'Make %s public now? Everything in its history becomes visible. [y/N] ' "$repo"
	read -r answer
	case "$answer" in
		y | Y) gh repo edit "$repo" --visibility public --accept-visibility-change-consequences && echo "visibility: public" ;;
		*) echo "visibility: left private" ;;
	esac
fi

# Security reports reach the maintainer privately, from the Security tab
# (needs a public repository).
gh api -X PUT "repos/$repo/private-vulnerability-reporting" >/dev/null 2>&1 &&
	echo "private vulnerability reporting: on" || echo "private vulnerability reporting: not set (repository still private?)"

printf '\nDone. Still by hand, in the browser:\n'
printf '  - Settings > General > Social preview: upload docs/images/banner.png\n'
printf '  - Discussions: pin an Ideas post, "What should your pet nudge you about?"\n'
printf '  - Issues: open two or three "feedback wanted" issues from ROADMAP.md\n'
