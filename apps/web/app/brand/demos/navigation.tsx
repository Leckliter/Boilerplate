'use client';

import { Breadcrumbs } from '@app/ui/components/breadcrumbs';
import { Button, RefreshButton } from '@app/ui/components/button';
import { ButtonGroup } from '@app/ui/components/button-group';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@app/ui/components/card';
import { Collapsible } from '@app/ui/components/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@app/ui/components/dropdown-menu';
import { Grid, GridItem } from '@app/ui/components/grid';
import {
  CaretDownIcon,
  CopyIcon,
  GearIcon,
  GridFourIcon,
  HouseIcon,
  ListIcon,
  PlusIcon,
  TrashIcon,
  UsersIcon,
} from '@app/ui/components/icons';
import { LayerCard } from '@app/ui/components/layer-card';
import { Link } from '@app/ui/components/link-component';
import { LinkButton } from '@app/ui/components/link-button';
import { linkVariants } from '@app/ui/components/link';
import { MenuBar } from '@app/ui/components/menubar';
import { Pagination } from '@app/ui/components/pagination';
import { Separator } from '@app/ui/components/separator';
import { Sidebar } from '@app/ui/components/sidebar';
import {
  Table,
  TableBody,
  TableCell,
  TableCheckCell,
  TableCheckHead,
  TableHead,
  TableHeader,
  TableRow,
} from '@app/ui/components/table';
import { TableOfContents, useTableOfContentsActiveId } from '@app/ui/components/table-of-contents';
import { Toolbar } from '@app/ui/components/toolbar';
import NextLink from 'next/link';
import { useState } from 'react';

function Block({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-hairline py-10">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mb-5 text-sm text-muted-foreground">{description}</p>}
      {children}
    </section>
  );
}

const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-3">{children}</div>
);

const VARIANTS = [
  'primary',
  'secondary',
  'ghost',
  'outline',
  'destructive',
  'secondary-destructive',
  'link',
] as const;

function ButtonDemos() {
  return (
    <>
      <Block
        title="Button"
        description="Variants primary (one per screen), secondary (default), ghost, outline, destructive, secondary-destructive, link. Sizes xs, sm, base (md), lg."
      >
        <div className="grid gap-4">
          <Row>
            {VARIANTS.map((v) => (
              <Button key={v} variant={v}>
                {v}
              </Button>
            ))}
          </Row>
          <Row>
            {VARIANTS.map((v) => (
              <Button key={v} variant={v} disabled>
                {v}
              </Button>
            ))}
          </Row>
          <Row>
            <Button size="xs">xs</Button>
            <Button size="sm">sm</Button>
            <Button>base</Button>
            <Button size="lg">lg</Button>
            <Button variant="primary" size="lg">
              lg primary
            </Button>
          </Row>
          <Row>
            <Button icon={PlusIcon} variant="primary">
              With icon
            </Button>
            <Button icon={<PlusIcon />}>Icon element</Button>
            <Button loading variant="primary">
              Saving
            </Button>
            <Button loading>Loading</Button>
            <Button variant="secondary" title="Shown as a tooltip">
              Hover me
            </Button>
          </Row>
          <Row>
            <Button shape="square" size="xs" aria-label="Add" icon={PlusIcon} />
            <Button shape="square" size="sm" aria-label="Add" icon={PlusIcon} />
            <Button shape="square" aria-label="Add" icon={PlusIcon} />
            <Button shape="square" size="lg" aria-label="Add" icon={PlusIcon} />
            <Button shape="circle" aria-label="Add" icon={PlusIcon} variant="primary" />
            <Button size="icon" variant="ghost" aria-label="Settings" icon={GearIcon} />
            <Button size="icon-sm" variant="ghost" aria-label="Settings" icon={GearIcon} />
            <RefreshButton />
          </Row>
          <Row>
            <LinkButton href="/brand" variant="primary">
              LinkButton
            </LinkButton>
            <LinkButton href="/brand" variant="secondary" icon={HouseIcon}>
              With icon
            </LinkButton>
            <LinkButton href="/brand" variant="ghost" external>
              External
            </LinkButton>
            <LinkButton href="/brand" disabled>
              Disabled
            </LinkButton>
          </Row>
        </div>
      </Block>

      <Block
        title="ButtonGroup"
        description="Joins tightly-coupled buttons, mostly a split button: an action and a menu."
      >
        <div className="flex flex-wrap items-center gap-6">
          <ButtonGroup aria-label="Deploy">
            <Button variant="primary">Deploy</Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="primary"
                    shape="square"
                    aria-label="More deploy options"
                    icon={CaretDownIcon}
                  />
                }
              />
              <DropdownMenuContent>
                <DropdownMenuItem>Deploy to staging</DropdownMenuItem>
                <DropdownMenuItem>Deploy to production</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
          <ButtonGroup aria-label="View">
            <Button>Day</Button>
            <Button>Week</Button>
            <Button>Month</Button>
          </ButtonGroup>
        </div>
      </Block>
    </>
  );
}

function LinkDemos() {
  return (
    <Block
      title="Link"
      description="`Link` (inline, current, plain) renders through the app's LinkProvider. `linkVariants({ tone })` styles a Next <Link> in our app style."
    >
      <div className="grid gap-3">
        <p>
          Inline: <Link href="/docs">Read the docs</Link>, or{' '}
          <Link href="https://example.com" target="_blank" rel="noopener noreferrer">
            visit example.com <Link.ExternalIcon />
          </Link>
          .
        </p>
        <p className="text-muted-foreground">
          Current colour:{' '}
          <Link variant="current" href="/docs">
            inherits the text colour
          </Link>
        </p>
        <p>
          Plain:{' '}
          <Link variant="plain" href="/docs">
            no underline
          </Link>
        </p>
        <p>
          App tones:{' '}
          <NextLink href="/docs" className={linkVariants()}>
            primary
          </NextLink>{' '}
          ·{' '}
          <NextLink href="/docs" className={linkVariants({ tone: 'inherit' })}>
            inherit
          </NextLink>{' '}
          ·{' '}
          <NextLink href="/docs" className={linkVariants({ tone: 'muted' })}>
            muted
          </NextLink>
        </p>
      </div>
    </Block>
  );
}

function CrumbsAndPages() {
  const [page, setPage] = useState(3);
  const [perPage, setPerPage] = useState(25);
  const [simplePage, setSimplePage] = useState(1);
  return (
    <>
      <Block
        title="Breadcrumbs"
        description="Ancestors never shrink; the current page truncates. On a phone a long trail collapses to “… › parent › current”."
      >
        <div className="grid gap-2">
          <Breadcrumbs>
            <Breadcrumbs.Link href="/brand" icon={<HouseIcon />}>
              Home
            </Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Link href="/brand">Admin</Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Link href="/brand">Projects</Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Current>Project 1042</Breadcrumbs.Current>
            <Breadcrumbs.Clipboard text="/admin/projects/1042" />
          </Breadcrumbs>
          <Breadcrumbs size="sm">
            <Breadcrumbs.Link href="/brand">Small</Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Current loading>Loading</Breadcrumbs.Current>
          </Breadcrumbs>
        </div>
      </Block>

      <Block
        title="Pagination"
        description='Compound API: Info, PageSize, Controls. `controls="simple"` for previous/next only, or an unknown total with hasNextPage.'
      >
        <div className="grid gap-6">
          <Pagination page={page} setPage={setPage} perPage={perPage} totalCount={500}>
            <Pagination.Info />
            <Pagination.Separator />
            <Pagination.PageSize value={perPage} onChange={setPerPage} />
            <Pagination.Controls />
          </Pagination>
          <Pagination
            page={simplePage}
            setPage={setSimplePage}
            perPage={10}
            totalCount={95}
            controls="simple"
          />
          <Pagination page={simplePage} setPage={setSimplePage} hasNextPage={simplePage < 4} />
        </div>
      </Block>
    </>
  );
}

function MenuDemos() {
  const [sort, setSort] = useState('newest');
  const [view, setView] = useState(0);
  return (
    <>
      <Block
        title="DropdownMenu"
        description="Items with icons, danger items, links, groups with labels, radio choices (a label must sit inside a group). Also the compound form DropdownMenu.Item …"
      >
        <Row>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button icon={GearIcon}>Actions</Button>} />
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Project</DropdownMenuLabel>
                <DropdownMenuItem icon={CopyIcon}>Duplicate</DropdownMenuItem>
                <DropdownMenuItem icon={UsersIcon}>Assign</DropdownMenuItem>
                <DropdownMenuLinkItem href="/brand">Open page</DropdownMenuLinkItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" icon={TrashIcon}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline">Sort: {sort}</Button>} />
            <DropdownMenuContent>
              <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuRadioItem value="newest">Newest</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="oldest">Oldest</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenu.Trigger render={<Button variant="ghost">Compound form</Button>} />
            <DropdownMenu.Content>
              <DropdownMenu.Item selected>Selected</DropdownMenu.Item>
              <DropdownMenu.CheckboxItem defaultChecked>Checkbox</DropdownMenu.CheckboxItem>
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger>More</DropdownMenu.SubTrigger>
                <DropdownMenu.SubContent>
                  <DropdownMenu.Item>Nested item</DropdownMenu.Item>
                </DropdownMenu.SubContent>
              </DropdownMenu.Sub>
            </DropdownMenu.Content>
          </DropdownMenu>
        </Row>
      </Block>

      <Block
        title="MenuBar"
        description="Icon bar with arrow-key navigation (Kumo prefers Tabs for this)."
      >
        <MenuBar
          isActive={view}
          options={[
            { icon: <ListIcon />, tooltip: 'List view', onClick: () => setView(0) },
            { icon: <GridFourIcon />, tooltip: 'Grid view', onClick: () => setView(1) },
          ]}
        />
      </Block>

      <Block
        title="Toolbar"
        description="One card of controls with roaming arrow-key focus: Toolbar.Button, .Link, .Input, .InputGroup."
      >
        <Toolbar aria-label="Formatting">
          <Toolbar.Button icon={PlusIcon} aria-label="Add" />
          <Toolbar.Button>Bold</Toolbar.Button>
          <Toolbar.Button>Italic</Toolbar.Button>
          <Toolbar.Link href="/brand">Help</Toolbar.Link>
          <Toolbar.Input aria-label="Search" placeholder="Search" />
        </Toolbar>
      </Block>
    </>
  );
}

function LayoutDemos() {
  const { activeId, selectSection } = useTableOfContentsActiveId({ ids: ['intro', 'setup'] });
  return (
    <>
      <Block
        title="Collapsible"
        description="Collapsible.DefaultTrigger + DefaultPanel is the classic look; Trigger and Panel take your own markup."
      >
        <Collapsible>
          <Collapsible.DefaultTrigger>Show details</Collapsible.DefaultTrigger>
          <Collapsible.DefaultPanel>
            <p className="text-muted-foreground">Content revealed when open.</p>
          </Collapsible.DefaultPanel>
        </Collapsible>
      </Block>

      <Block
        title="Table"
        description="Striped rows, selected rows, checkboxes, sticky header and columns."
      >
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableCheckHead label="Select all" />
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCheckCell />
                <TableCell>Scissor lift</TableCell>
                <TableCell>Available</TableCell>
              </TableRow>
              <TableRow variant="selected">
                <TableCheckCell checked onCheckedChange={() => undefined} />
                <TableCell>Pressure washer</TableCell>
                <TableCell>Rented</TableCell>
              </TableRow>
              <TableRow>
                <TableCheckCell />
                <TableCell>Tile saw</TableCell>
                <TableCell>In service</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </Block>

      <Block
        title="Table of contents"
        description="Presentational; pair with useTableOfContentsActiveId for scroll-spy."
      >
        <TableOfContents>
          <TableOfContents.Title>On this page</TableOfContents.Title>
          <TableOfContents.List>
            <TableOfContents.Item
              href="#intro"
              active={activeId === 'intro' || activeId === null}
              onClick={() => selectSection('intro')}
            >
              Introduction
            </TableOfContents.Item>
            <TableOfContents.Group label="Getting started">
              <TableOfContents.Item href="#setup" active={activeId === 'setup'}>
                Setup
              </TableOfContents.Item>
            </TableOfContents.Group>
          </TableOfContents.List>
        </TableOfContents>
      </Block>

      <Block
        title="Grid"
        description="Responsive presets: 2up, side-by-side, 2-1, 1-2, 3up, 4up, 6up, 1-2-4up."
      >
        <Grid variant="3up" gap="sm">
          {[1, 2, 3].map((n) => (
            <GridItem key={n}>
              <LayerCard className="p-4">Item {n}</LayerCard>
            </GridItem>
          ))}
        </Grid>
      </Block>

      <Block
        title="Card and LayerCard"
        description="Card keeps its API (header, title, description, content, footer); LayerCard is Kumo's layered surface."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Card title</CardTitle>
              <CardDescription>Card description.</CardDescription>
            </CardHeader>
            <CardContent>Card content.</CardContent>
          </Card>
          <LayerCard>
            <LayerCard.Secondary>Next steps</LayerCard.Secondary>
            <LayerCard.Primary>Get started with the catalog.</LayerCard.Primary>
          </LayerCard>
        </div>
        <Separator className="my-6" />
        <div className="flex h-6 items-center gap-3 text-sm">
          One <Separator orientation="vertical" /> Two <Separator orientation="vertical" /> Three
        </div>
      </Block>

      <Block
        title="Sidebar"
        description="Kumo's sidebar (not used in screens yet). Contained here so it stays inside the box; collapse it with the button."
      >
        <div className="relative h-80 overflow-hidden rounded-lg ring ring-border">
          <Sidebar.Provider contained>
            <Sidebar>
              <Sidebar.Content>
                <Sidebar.Group>
                  <Sidebar.GroupLabel>Overview</Sidebar.GroupLabel>
                  <Sidebar.Menu>
                    <Sidebar.MenuButton icon={HouseIcon} active>
                      Home
                    </Sidebar.MenuButton>
                    <Sidebar.MenuButton icon={UsersIcon}>Customers</Sidebar.MenuButton>
                  </Sidebar.Menu>
                </Sidebar.Group>
              </Sidebar.Content>
              <Sidebar.Footer>
                <Sidebar.Trigger />
              </Sidebar.Footer>
            </Sidebar>
          </Sidebar.Provider>
        </div>
      </Block>
    </>
  );
}

/** Navigation and layout components on /brand: Button, Link, Breadcrumbs, Pagination, DropdownMenu, Toolbar, Table, Card, Sidebar … */
export default function NavigationDemos() {
  return (
    <>
      <ButtonDemos />
      <LinkDemos />
      <CrumbsAndPages />
      <MenuDemos />
      <LayoutDemos />
    </>
  );
}
