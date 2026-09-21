# Concepts

- **Volt:** knowledge plus its definition and boundaries. The definition
  describes identity, purpose, storage location, expected fields/template,
  audience, groups, policies, autonomy and connection references. A directory
  alone is not a volt.
- **Worm connection:** a declared route between volts with record selection,
  transformation and a propagation bound. The only authoritative connection
  configuration is the host's `connections.json` registry. Volt definitions
  contain IDs, not copied connection policies.
- **Worm agent:** a worker executing permitted operations. Background work has
  no extra privilege. The prototype's executor runs explicitly in the caller
  process.
- **Connector:** an adapter to a system, exposing read, write, list and
  optionally observe capabilities. Capabilities describe I/O support, not
  authorization.
- **Integrator:** an application workflow composing core services, connectors
  and workers. The local summary integrator binds the two example volts to an
  executor.
- **Sidecar:** an optional separately deployed component for additional
  enforcement or isolation. None is implemented. Actual isolation would depend
  on OS or infrastructure controls, independently enforced credentials and
  constrained I/O.

A working volt is a volt used for task context, not a special storage engine.
Preparing one requires selection and policy just like any other transfer. A
public volt expresses the destination's intended audience; it does not host a
public URL.
