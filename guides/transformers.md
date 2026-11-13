# Transformers

A transformer is a node on a volt. A worm delivers a copy into the transformer's inbox folder. The transformer shapes that copy and writes the result into another folder on the same volt. A later worm can pull that folder. That is how a transformer sits in a chain: receive, shape, and leave a folder the next worm is allowed to read.

The shaped record keeps the trail of volts the knowledge has already passed through. A later hop can carry it onward. A hop back into a volt already on that trail stops.

## Steps

Steps run in order. With no steps, the fields pass through and the new file is the only change.

| Step | What it writes |
| --- | --- |
| `keep:type,title,body` | Only these fields remain. |
| `rename:title=summary` | The value moves to another field name. |
| `set:type=notice` | The field becomes this fixed text. |
| `redact:title,body` | Email addresses, phone numbers, national-id numbers, and card numbers in those fields become `[redacted]`. |
| `brief:body=2` | The field keeps that many opening sentences, at most 320 characters. |
| `extract:body=beans` | Links and citation ids. A topic keeps a reference when the word appears in the link text, the address, or the sentence that holds it. `extract:body` keeps every reference. |

The crawl shapes the copy on this computer. A brief on a release or a worm rule stays stored text. When an extract finds no reference, the out folder is left unchanged.

## Examples

The Transformers page offers three ready-made shapes. Each one asks which volt receives the copy, then saves the inbox, the out folder, and the steps.

| Example | Inbox | Out folder | What the next worm reads |
| --- | --- | --- | --- |
| Remove personal details | `knowledge/pii-in/` | `knowledge/cleared/` | The same record with those personal details replaced. |
| Brief note | `knowledge/brief-in/` | `knowledge/briefs/` | A note whose body is the opening two sentences. |
| Extract references | `knowledge/reference-in/` | `knowledge/references/` | A reference record. Type a topic on the extract step to keep references that mention it. |

```sh
wormvolt transform example redact-pii --volt desk
wormvolt transform example brief-note --volt desk
wormvolt transform example topic-references --volt desk --topic beans
```

A second crawl of the same delivery finds the same shaped file and leaves it. Add another transformer when the shape should change. Remove a transformer when no connection still delivers to it.

## A chain

1. Create the transformer on the volt that will receive the copy. Name the inbox and the out folder. They are two different folders inside that volt.
2. On the worm's connection, choose that transformer. Copies arrive in the inbox. Shaped records appear in the out folder. Folder rows on that connection wait, because the transformer names both places.
3. Point a later worm at the out folder, and at the content type the steps produced.

The release on the source volt still runs before the delivery. The out folder is ordinary knowledge on the destination volt, so a release there can decide what the next worm may take.

## Panel

Open **Transformers**. The graph draws each transformer beside the volt it lives on.

A rule has **Deliver through a transformer**. The list shows transformers on the destination volt.

## CLI

```sh
wormvolt transform add notice-shaper \
  --name "Notice shaper" \
  --volt desk \
  --in knowledge/inbox/ \
  --out knowledge/notices/ \
  --step keep:type,title,body \
  --step set:type=notice

wormvolt connect add reader-in \
  --worm reader \
  --direction inbound \
  --peer plot \
  --types note \
  --fields type,title,body \
  --transformer notice-shaper

wormvolt transform list
wormvolt transform remove notice-shaper
```

`--step` can be repeated. The order on the command line is the order the steps run.
