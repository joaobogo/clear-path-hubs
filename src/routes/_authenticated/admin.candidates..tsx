
function JourneyTab({ matchId }: { matchId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["candidate-journey", matchId],
    queryFn: () => getCandidateJourney({ data: { candidateMatchId: matchId } }),
  });
  if (isLoading) return <div className="text-sm text-muted-foreground">Loading timeline…</div>;
  const events = data?.events ?? [];
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-base font-semibold">Candidate journey</h2>
        <p className="text-xs text-muted-foreground">
          Full relationship at a glance — from sourced or applied through rehire.
        </p>
      </header>
      <JourneyTimeline events={events} />
    </div>
  );
}
