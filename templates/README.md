# Volt definition seeds

`personal-knowledge/volt.json` and `team-project/volt.json` are valid
conservative version-1 definitions. Both allow the trusted `owner` group to
read/write, remain in manual mode and have no connections or sharing grants.
They require a host-provisioned `knowledge` directory and structured records
with `title` and `summary` fields; `notes` is optional.

Copy and tailor a seed using the [extension guide](../docs/extension-guide.md).
Neither seed provisions authentication or a runnable workflow. The complete
runnable configuration is in `examples/local-volt-sync`.
