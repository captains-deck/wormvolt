# Release interfaces

A volt may be any folder. Notes, exports, and dumps do not share a schema, so
a rule that only names a record type cannot say "this directory stays here."
The **release interface** is the gate on the volt. Worms receive only what it
surfaces. A worm's own rule is an **aim**: it asks. The release grants.

The desktop crawl enforces path, kind, and block limits. Briefs are saved with
the volt and with the worm rule. This crawl does not send a brief to a model.
The decision behind these names is
[ADR 0003](../../WormVoltDesktop/docs/decisions/0003-release-interfaces.md).

## Names

- **Release interface.** The gate on a source volt. It is edited in the project
  that owns that volt.
- **Scope.** The deterministic part of a release: folders, files, and kinds.
- **Kind.** The lowercased extension, without a dot. `Notes.MD` has kind `md`.
  A file with no extension has no kind. List `jpg` and `jpeg` separately when
  both should pass. Renaming a file changes its kind, so a document that must
  stay in the volt is named with a deny path.
- **Block interface.** Optional phrases on the release. A match withholds the
  copy. This gate reads contents, so it costs more, and a reworded sentence
  can still pass.
- **Brief.** Short agent context, on the release or on one worm rule. It is
  saved for a later model step. The release interface is the safeguard: a
  prompt can miss a secret written as an ordinary sentence.
- **Aim.** The worm rule: content types, fields, and optional paths, kinds,
  and a brief. An aim can only narrow a release.

"Interceptor" is the runtime role of these gates. The panel calls them a
release, a block phrase list, and a brief.

## When the gate is on

A volt with no `worm/release.json` stays open to worm rules. The crawl uses
the connection's content types, fields, and the worm's depth. Attaching a
folder keeps that behaviour, so an existing vault can be crawled before anyone
writes a release.

Saving a release turns the gate on for every worm that can reach the volt,
including a worm added later. Adding a connection does not open a denied path.

A saved release with no allow folder and no allow kind is closed. Worms copy
nothing from it. In the panel, **Close the volt** clears both allow lists.
On the CLI, `--close` writes that empty release.

Deny beats allow. A deny path matches before an allow path. A deny kind
matches before an allow kind.

## Scope

Paths are relative to the volt root. Rules reject a leading slash, a
backslash, an empty segment, `.`, and `..`. A path that leaves the root is
withheld as unsafe and is not opened.

| Rule | Matches |
| --- | --- |
| `knowledge/` | That folder and everything under it. The trailing slash is what makes it a folder. |
| `supplier-terms.md` | That filename in any folder. A rule with no slash matches the filename only. |
| `knowledge/supplier-terms.md` | That one path. |
| `*.md` | A filename of that shape, in any folder. |
| `knowledge/*.md` | Markdown files directly inside `knowledge/`. |
| `**` | Any path. An allow of `**` still loses to a deny. |

`*` matches inside one path segment. `**` is a whole segment and means any
depth. A folder rule is that folder plus `**`.

A file is withheld when any of these is true:

1. A deny path matches.
2. A deny kind matches.
3. The release lists allow paths, and none match.
4. The release lists allow kinds, and the file's kind is absent.
5. The release lists neither allow paths nor allow kinds (the volt is closed).
6. The worm rule lists paths, and none match.
7. The worm rule lists kinds, and the file's kind is absent.

An empty path list on a worm rule adds no extra path limit. An empty kind list
adds no extra kind limit. The release, when one is saved, still applies.

A matching path or kind decision seals the candidate. The crawl remembers the
withhold and does not open the file. A symlink is skipped by the store before
that check.

## Block interface

Block phrases live on the release. The crawl joins the fields that rule would
copy and looks for each phrase as a case-insensitive substring. A match
withholds the whole copy. The log records the code `BLOCKED` and leaves the
matched text out of the activity line.

Scope runs first, so a denied folder is left unopened. The scan sees the
fields that rule would copy. A phrase that appears only in some other field
stays out of the scan, and that field stays out of the copy.

The panel states the cost: the gate reads file contents, and the cost follows
the number of bytes and the number of worms. A phrase can miss the same fact
written another way. Keep a private folder with a deny path. Use a block
phrase for a match that turns up inside a file the release otherwise allows.

Up to 32 phrases, each up to 120 characters. The comparison ignores case, so
`Tool fund` and `tool fund` are one phrase.

## Brief

Write a brief as a narrowing instruction: "Surface open days, seed lists, and
crop notes. Leave the tool fund." The release brief describes what the volt is
willing to surface. The worm's brief describes what that rule is looking for.

Both are stored and shown in the panel. Today's crawl applies path, kind, and
block limits and leaves the brief unused. No model call is made.

The brief is specified so a later model step can be added without loosening
the gate:

- Scope and block run first. A denied folder is never sent to a model.
- The host sends one candidate at a time and accepts yes or no. A path the
  model invents is ignored.
- A timeout, an error, or an unclear answer withholds the file.
- The worm brief runs after the volt brief and can only drop more files.
- Turning the model step on is a separate choice from saving the text, because
  the model vendor then sees the candidate.

A brief stays under 2000 characters.

## Combining rules

Limits on one rule all have to match. The crawl copies a file when the release
allows it and the rule's paths, kinds, content types, fields, and hop depth
all agree. Fields are the core allowlist: the destination receives those
fields whole.

Another rule is another connection. Rules on the same worm are independent, so
a file that fails one rule can still pass another. Two rules may pull from the
same volt when the limit set differs: types, fields, paths, kinds, or brief.
The same worm, direction, peer, and the same limits are rejected. The message
is that this worm already has a rule with that route and those limits.

In the panel:

1. Open **Volts**, expand the volt's release, set allow and deny paths and
   kinds, and save. **Allow knowledge notes** fills `knowledge/` and `md`.
2. Open **Worms** and choose **Create worm**. Each rule block is one
   connection. **Add another rule** before saving when one worm needs two
   combinations.
3. Open **Connections** to add one more rule to a worm that already exists.
   Filter the list by worm or volt. The form is the same rule editor.

Leave a rule's folders and file types empty when the release is the only path
and kind limit you want.

```sh
npx wormvolt volt release shop-inventory-management \
  --allow knowledge/ \
  --deny knowledge/supplier-terms.md \
  --kinds md \
  --brief "Share shelf counts. Leave supplier terms on this volt."

npx wormvolt worm create bed-reader --name "Bed reader" --home desk

npx wormvolt connect add bed-reader-rule-1 \
  --worm bed-reader --direction inbound --peer lane \
  --types note --fields type,title,body \
  --paths knowledge/ --kinds md \
  --brief "Crop notes under knowledge."

npx wormvolt connect add bed-reader-rule-2 \
  --worm bed-reader --direction inbound --peer lane \
  --types event --fields type,title,body \
  --kinds md
```

Rule 1 copies a note under `knowledge/` when it is markdown. Rule 2 copies an
event of kind `md` from any path the release allows. A supplier-terms file
named by the deny matches neither rule, and the file stays unopened. An event
fails rule 1 on type and can still pass rule 2.

`--close` replaces the release with empty allow lists. Pass at least one of
`--allow`, `--deny`, `--kinds`, `--deny-kinds`, `--block`, or `--brief` when
you are not closing the volt.

## Order of a pull

1. Release scope, then the worm rule's paths and kinds. A withhold here does
   not open the file.
2. Content type.
3. Hop depth. Depth skips are reconsidered on the next crawl.
4. Unchanged contents, using the cursor for this worm, volt, and connection.
   One rule's rejection does not suppress another rule's copy of the same file.
5. Read, when the candidate is a structured record that passed the name checks.
6. Type and depth again, from the record that was read.
7. Block phrases against the fields that would be copied.
8. Core share, transform, and write of those fields.

A saved brief sits outside this sequence. Path and kind rejections, a closed
release, and a block match are remembered on that connection's cursor.
Saving a release clears cursors for that volt, so a file a previous release
withheld is considered again. Adding a connection clears that worm's cursors.

The crawl lists Markdown it can safely address: records under `knowledge/`,
and other `.md` notes in the folder. Hidden names, the `worm/` directory, and
notes more than a few folders down are skipped, and a filename has to become a
safe record id. The release language accepts any extension. A kind such as
`png` is a valid rule and applies when a candidate of that kind is considered.
A propagation index, `worm/recent.json`, is preferred over a directory listing.
Each indexed record is checked at the path where it landed. An older index
without a path is read as `knowledge/<id>.md`.

## Where copies land

Every destination volt has a target folder. New volts use `knowledge/`. The
Volts page shows it as **Copies land in**, and `wormvolt volt folder <id>
--into <folder>` changes it. A folder already holding a copy keeps that copy.
Later copies use the new folder.

A connection can add detail in **Destination folders**:

- Leave the connection folder blank and the copies use the destination volt's
  target folder.
- Name a folder on the connection when this route should land somewhere else.
- Add a row for a file type, a content type, or both. `pdf` can land in
  `knowledge/files/`. `event` can land in `knowledge/events/`. The first
  matching row wins. Other copies use the connection folder, or the volt's
  folder when the connection leaves that blank.

The copy is a Markdown record in the folder you name. The file type is the
source path's extension. The content type is the record's `type` field. A row
for `pdf` matches a source path ending in `.pdf`. The crawl places the records
it copies; a later worm still has to pass that volt's release, so a folder
outside an allow path stays put.

```sh
npx wormvolt volt folder desk --into knowledge/
npx wormvolt connect add sorter \
  --worm bed-reader --direction inbound --peer lane \
  --types note,event --fields type,title,body \
  --place type:event=knowledge/events/ \
  --place kind:pdf,png=knowledge/files/
```

Two rules can share a route and differ only by where the copies land.

## Where a release lives

`volt.json` stays a strict core definition. The release is one file beside the
guard and subset files:

`worm/release.json`

```json
{
  "schemaVersion": 1,
  "allowPaths": ["knowledge/"],
  "denyPaths": ["knowledge/supplier-terms.md"],
  "allowKinds": ["md"],
  "denyKinds": [],
  "blocks": [],
  "brief": "Share shelf counts. Leave supplier terms on this volt."
}
```

Allow and deny path lists hold up to 64 rules. Kind lists hold up to 16.
Unknown keys are rejected.

## Where copies land

Every destination volt has a target folder. New volts use `knowledge/`. The
Volts page shows it as **Copies land in**, and `wormvolt volt folder <id>
--into knowledge/notes/` changes it. Copies already in the volt stay in the
folder where they first landed.

A connection can add more detail. Leave its folder blank and the destination
volt's target folder receives every copy. A placement row sends one kind of
copy somewhere else. The first matching row wins. A row can name file types,
content types, or both, so pdfs can land in `knowledge/files/` while events
land in `knowledge/events/`.

```sh
npx wormvolt volt folder harbour-notes --into knowledge/

npx wormvolt connect add sorter \
  --worm bed-reader --direction inbound --peer lane \
  --types note,event --fields type,title,body \
  --into knowledge/ \
  --place type:event=knowledge/events/ \
  --place kind:pdf,png=knowledge/files/
```

The copy is a Markdown record in that folder. The file type is the source
file's extension. The content type is the record's type field. A later worm
sees the real path, such as `knowledge/events/<id>.md`, so a release that
allows `knowledge/` still covers the subfolder. A release that allows only
`knowledge/*.md` does not cover files nested one level down.

The aim lives on the connection, in the registry of the project that owns the
worm. Cloning a worm copies its paths, kinds, and brief into the new project
for each route whose peer volt already exists there. The source volt's release
stays in the project that owns the volt. An imported
worm stays owned elsewhere: its aim is read there, and it still faces the
release on the volt it reads.

A sidecar has its own release. The guard is the only worm aimed at a main volt
that has a sidecar. Collectors face the sidecar release, which can be tighter
than the set the guard copied.

## What a later deny leaves behind

A file already copied into another volt stays there when a deny is added. The
next crawl withholds it. Deleting the copy is a separate step.

## A small shop

The corner shop demo is this standard in one project. Shop inventory management
allows `knowledge/` markdown and denies `knowledge/supplier-terms.md`. Its
brief asks for shelf counts and says to leave supplier terms on that volt.
Stock volt is the sidecar, and its subset is notes only, so the copy is shelf
counts. The chatbot worm and the website worm read that sidecar. The website
worm also files a till order back onto the inventory volt, into
`knowledge/orders/`.

Product research denies `knowledge/scout-margin.md`. Product Scout is its
guard and also reads the market board, adding those products to the
product-shortlist sidecar. Team training helpbot reads new shelf items from
the stock volt and training events from the team roster. A transformer on the
training-flags volt writes each of those events into `knowledge/flags/`.

Supplier terms stay on the inventory volt because the deny matches that file
before the guard opens it. The brief is stored beside that deny.
