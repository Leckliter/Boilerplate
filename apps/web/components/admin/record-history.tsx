import { callAction, listActivity, listChanges } from '@app/core';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@app/ui/components/card';

import { ActionError } from '@/components/action-error';
import { ActivityList, actorLabel, timeFormat } from './activity-list';
import { ChangeList } from './change-list';
import type { Viewer } from '@/lib/viewer';

type SignedIn = Extract<Viewer, { status: 'signed_in' }>;

/**
 * A record's History tab: what was done to it (activity) and every field that
 * changed (change log), for staff who can read the audit trail.
 */
export async function RecordHistory({
  viewer,
  subjectId,
  what,
}: {
  viewer: SignedIn;
  subjectId: string;
  /** "this contact", "this order" … for the descriptions. */
  what: string;
}) {
  if (!viewer.can('activity.read')) {
    return (
      <p className="text-sm text-muted-foreground">Your role can’t see the history of records.</p>
    );
  }
  const [activity, changes] = await Promise.all([
    callAction(listActivity, { subjectId, limit: 30 }, viewer.actor),
    callAction(listChanges, { subjectId, limit: 50 }, viewer.actor),
  ]);
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>Who did what to {what}, newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {activity.ok ? (
            <ActivityList entries={activity.data} />
          ) : (
            <ActionError error={activity.error} what="the activity" />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Field history</CardTitle>
          <CardDescription>
            Every change to the details of {what}, old → new, including changes made outside the
            app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {changes.ok ? (
            <ChangeList
              changes={changes.data.map((ch) => ({
                ...ch,
                who: `${
                  ch.activityId
                    ? actorLabel({
                        actorKind: ch.actorKind,
                        actorName: ch.actorName,
                        apiKeyName: ch.apiKeyName,
                      })
                    : 'outside the app'
                } · ${timeFormat.format(new Date(ch.occurredAt))}`,
              }))}
            />
          ) : (
            <ActionError error={changes.error} what="the field history" />
          )}
        </CardContent>
      </Card>
    </>
  );
}
