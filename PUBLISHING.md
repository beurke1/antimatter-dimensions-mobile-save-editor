# Publishing

Target repo:

`beurke1/antimatter-dimensions-mobile-save-editor`

The local repo is ready to push once GitHub CLI auth is available or the empty GitHub repo has been created another way.

## Create And Push With `gh`

```sh
gh auth login
gh repo create beurke1/antimatter-dimensions-mobile-save-editor --public --source=. --remote=origin --push
```

## Push To An Existing Empty Repo

```sh
git remote add origin https://github.com/beurke1/antimatter-dimensions-mobile-save-editor.git
git push -u origin main
```

