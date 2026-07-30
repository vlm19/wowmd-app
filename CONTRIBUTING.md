# Contributing to wowMD

Thanks for helping improve wowMD. By submitting a contribution, you agree that
it is your original work (or that you have the right to submit it) and that it
is provided under the repository's Apache-2.0 license.

## Before opening a pull request

1. Keep Markdown documents, annotations, credentials, personal data, and local
   test artifacts out of commits.
2. Make changes in `app/src/` rather than editing the generated `website/app/`
   output directly.
3. Run the checks relevant to your change:

   ```powershell
   npm.cmd run lint
   npm.cmd run test
   npm.cmd run build
   npm.cmd --prefix ..\website run verify
   ```

4. Include tests for behavior changes and retain the local-first boundary:
   opening and reviewing Markdown must not upload its contents.

## Pull requests

Describe the user-facing behavior, the validation performed, and any privacy,
security, or compatibility impact. Do not include secrets or private documents
in issue reports, commits, screenshots, or fixtures.
