import { callAction, listApiKeys } from '@app/core';
import { Badge } from '@app/ui/components/badge';
import { Callout } from '@app/ui/components/callout';
import { Card } from '@app/ui/components/card';
import { Empty } from '@app/ui/components/empty';
import { KeyIcon } from '@app/ui/components/icons';
import { PageHeader } from '@app/ui/components/page';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@app/ui/components/table';
import { formatDate } from '@app/ui/lib/dates';

import { ActionError } from '@/components/action-error';
import { CreateApiKey } from '@/components/admin/create-api-key';
import { DeleteForm } from '@/components/forms/delete-form';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'API keys' };

export default async function ApiKeysPage() {
  const viewer = await requireViewer('api_keys.manage', '/admin/api-keys');
  const keys = await callAction(listApiKeys, {}, viewer.actor);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="API keys"
        description="Your keys for the REST API (/api/v1/actions) and MCP (/api/mcp, for AI assistants). A key can do what you can, nothing more."
        actions={<CreateApiKey />}
      />
      <Callout tone="info">
        Send <code className="font-mono text-xs">Authorization: Bearer &lt;key&gt;</code>.
        Everything a key does is recorded in Activity, reads included.
      </Callout>
      <Card>
        {!keys.ok ? (
          <div className="p-5">
            <ActionError error={keys.error} what="your keys" />
          </div>
        ) : keys.data.length === 0 ? (
          <Empty
            icon={<KeyIcon />}
            title="No API keys yet"
            description="Create one to connect a script or an AI assistant."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Key</TableHead>
                <TableHead className="hidden md:table-cell">Last used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.data.map((k) => {
                const expired = k.expiresAt && k.expiresAt < new Date();
                return (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">
                      {k.name}
                      {k.permissions && (
                        <span className="block text-xs font-normal text-muted-foreground">
                          Limited to {k.permissions.length} permissions
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <code className="text-xs">{k.prefix}…</code>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {k.lastUsedAt ? formatDate(k.lastUsedAt) : 'Never'}
                    </TableCell>
                    <TableCell>
                      {k.revokedAt ? (
                        <Badge color="outline">Revoked</Badge>
                      ) : expired ? (
                        <Badge color="amber">Expired</Badge>
                      ) : (
                        <Badge color="green">Active</Badge>
                      )}
                      {k.expiresAt && !k.revokedAt && !expired && (
                        <span className="block text-xs text-muted-foreground">
                          Expires {formatDate(k.expiresAt)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!k.revokedAt && (
                        <DeleteForm
                          action="apiKeys.revoke"
                          input={{ id: k.id }}
                          size="sm"
                          label="Revoke"
                          title={`Revoke “${k.name}”?`}
                          description="Anything using this key stops working immediately."
                          confirmLabel="Revoke key"
                          success="Key revoked"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
