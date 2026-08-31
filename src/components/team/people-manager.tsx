"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { addPerson, removePerson } from "@/app/(app)/team/[teamId]/actions";
import { setTeamLeader } from "@/app/(app)/org-chart/actions";
import { viewAs } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Person = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  isLeader: boolean;
};

export function PeopleManager({ teamId, roster }: { teamId: string; roster: Person[] }) {
  const router = useRouter();
  const [isAdding, startAddTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isRemoving, startRemoveTransition] = useTransition();
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleAdd(formData: FormData) {
    setSummary(null);
    setError(null);
    startAddTransition(async () => {
      const result = await addPerson(teamId, formData);
      if (result && "error" in result) {
        setError(result.error);
      } else if (result) {
        setSummary(
          `Onboarded — granted access to ${result.appsGranted.join(", ")}.${
            result.autoShareEnabled ? " Auto-share is on for their future documents." : ""
          }`
        );
      }
      router.refresh();
    });
  }

  function handleRemove(userId: string) {
    setSummary(null);
    setError(null);
    setRemovingId(userId);
    startRemoveTransition(async () => {
      const result = await removePerson(teamId, userId);
      if (result) {
        setSummary(
          `Offboarded — ${result.docsTransferred} document${
            result.docsTransferred === 1 ? "" : "s"
          } transferred, access revoked for ${result.accessRevoked.join(", ")}.`
        );
      }
      setRemovingId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border rounded-xl border border-border">
        {roster.length === 0 ? (
          <li className="px-4 py-4 text-sm text-muted-foreground">No one on this team yet.</li>
        ) : (
          roster.map((person) => (
            <li key={person.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
                  {person.name.slice(0, 1)}
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    {person.name}
                    {person.isLeader ? <Badge variant="default">Leader</Badge> : null}
                    {person.status === "OFFBOARDED" ? (
                      <Badge variant="destructive">Offboarded</Badge>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{person.email}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {person.status === "ACTIVE" ? (
                  <>
                    {!person.isLeader ? (
                      <form action={() => setTeamLeader(teamId, person.id)}>
                        <Button variant="outline" size="sm" type="submit">
                          Make leader
                        </Button>
                      </form>
                    ) : null}
                    <form action={() => viewAs(person.id)}>
                      <Button variant="outline" size="sm" type="submit">
                        View as
                      </Button>
                    </form>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={isRemoving}
                      onClick={() => handleRemove(person.id)}
                    >
                      {isRemoving && removingId === person.id ? "Removing…" : "Remove"}
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>

      {summary ? (
        <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground">
          {summary}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <form action={handleAdd} className="grid grid-cols-1 gap-2 rounded-xl border border-border p-4 sm:grid-cols-[1fr_1fr_auto_auto]">
        <div className="space-y-1">
          <Label htmlFor="add-name">Name</Label>
          <Input id="add-name" name="name" placeholder="New hire's name" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="add-email">Email</Label>
          <Input id="add-email" name="email" type="email" placeholder="name@company.com" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="add-role">Role</Label>
          <select
            id="add-role"
            name="role"
            className="h-10 rounded-lg border border-foreground/20 bg-background px-2.5 text-sm text-foreground"
          >
            <option value="MEMBER">Member</option>
            <option value="TEAM_LEADER">Team Leader</option>
          </select>
        </div>
        <Button type="submit" disabled={isAdding} className="self-end">
          {isAdding ? "Adding…" : "Add Person"}
        </Button>
      </form>
    </div>
  );
}
