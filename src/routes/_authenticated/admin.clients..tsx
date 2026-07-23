
// ── Contacts tab ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ContactsTab({ org, members }: { org: any; members: any[] }) {
  const primary = {
    name: org.primary_contact_name as string | null,
    email: org.primary_contact_email as string | null,
    phone: org.phone as string | null,
  };
  return (
    <section className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Primary contact
        </div>
        {primary.name || primary.email || primary.phone ? (
          <div className="mt-2 grid gap-1 text-sm">
            <div className="font-medium">{primary.name ?? "—"}</div>
            {primary.email && (
              <a href={`mailto:${primary.email}`} className="text-primary hover:underline">
                {primary.email}
              </a>
            )}
            {primary.phone && <div className="text-muted-foreground">{primary.phone}</div>}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No primary contact set. Edit on the Company tab.
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <header className="border-b px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Team members with email ({members.filter((m) => m.profiles?.email).length})
        </header>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {members
              .filter((m) => m.profiles?.email)
              .map((m) => (
                <tr key={m.id}>
                  <td className="px-3 py-2">{m.profiles?.full_name ?? "—"}</td>
                  <td className="px-3 py-2">
                    <a
                      href={`mailto:${m.profiles.email}`}
                      className="text-primary hover:underline"
                    >
                      {m.profiles.email}
                    </a>
                  </td>
                  <td className="px-3 py-2 capitalize">{m.role}</td>
                  <td className="px-3 py-2 capitalize text-xs text-muted-foreground">
                    {m.status}
                  </td>
                </tr>
              ))}
            {members.filter((m) => m.profiles?.email).length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  No team contacts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Notes tab ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NotesTab({ org }: { org: any }) {
  const qc = useQueryClient();
  const [text, setText] = useState<string>(org.internal_notes ?? "");
  useEffect(() => setText(org.internal_notes ?? ""), [org.id, org.updated_at]);

  const m = useMutation({
    mutationFn: () =>
      updateClientNotes({ data: { id: org.id, internal_notes: text } }),
    onSuccess: async () => {
      toast.success("Notes saved");
      await qc.invalidateQueries({ queryKey: ["admin-client", org.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dirty = (text ?? "") !== (org.internal_notes ?? "");

  return (
    <section className="space-y-3">
      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        Internal notes are never visible to the client. Use for context, escalation info,
        and ops history.
      </div>
      <Textarea
        rows={14}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add notes for the platform team…"
        data-qa-action="client-notes-editor"
      />
      <div className="flex items-center gap-2">
        <Button
          disabled={!dirty || m.isPending}
          onClick={() => m.mutate()}
          data-qa-action="save-notes"
        >
          {m.isPending ? "Saving…" : "Save notes"}
        </Button>
        {dirty && (
          <button
            className="text-xs text-muted-foreground hover:underline"
            onClick={() => setText(org.internal_notes ?? "")}
          >
            Discard changes
          </button>
        )}
      </div>
    </section>
  );
}

// ── Documents tab ─────────────────────────────────────────────────────────
function DocumentsTab({ id }: { id: string }) {
  const { data } = useSuspenseQuery({
    queryKey: ["admin-client-documents", id],
    queryFn: () => getClientDocuments({ data: { id, limit: 100 } }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <header className="border-b px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Documents linked to this client's candidates ({rows.length})
      </header>
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">File</th>
            <th className="px-3 py-2 font-medium">Candidate</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium tabular-nums">Size</th>
            <th className="px-3 py-2 font-medium">Uploaded</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((f) => (
            <tr key={f.id} className="hover:bg-muted/30">
              <td className="px-3 py-2">
                <div className="font-medium">{f.filename}</div>
                <div className="text-[10px] text-muted-foreground">
                  status: {f.file_status}
                </div>
              </td>
              <td className="px-3 py-2">
                {f.candidate_profiles?.full_name ?? "—"}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {f.mime_type ?? "—"}
              </td>
              <td className="px-3 py-2 tabular-nums text-xs text-muted-foreground">
                {f.size ? `${(Number(f.size) / 1024).toFixed(0)} KB` : "—"}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {new Date(f.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                No documents uploaded by this client's candidates yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Messages tab (pointer view; full thread lives in workspace) ──────────
function MessagesTab({ orgId }: { orgId: string }) {
  return (
    <section className="space-y-3">
      <div className="rounded-lg border bg-card p-6 text-sm">
        <div className="flex items-start gap-3">
          <MessagesSquare className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="font-semibold">Messages</h2>
            <p className="mt-1 text-muted-foreground">
              Client conversations live inside the workspace so context, candidates, and
              positions stay linked. Open the workspace to read or reply.
            </p>
            <Link
              to="/client"
              search={{ org: orgId, preview: "client_admin" }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Open messages in workspace <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
