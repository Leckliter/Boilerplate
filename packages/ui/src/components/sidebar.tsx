'use client';

/**
 * Sidebar barrel: the implementation lives in ./sidebar/*.tsx (split by responsibility);
 * every name is re-exported here so `@app/ui/components/sidebar` is unchanged.
 */
import {
  SidebarClose,
  SidebarRail,
  SidebarResizeHandle,
  SidebarSeparator,
  SidebarTrigger,
} from './sidebar/controls';
import {
  SidebarCollapsible,
  SidebarCollapsibleContent,
  SidebarCollapsibleTrigger,
  SidebarMenuChevron,
} from './sidebar/collapsible';
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarLoading,
} from './sidebar/layout';
import {
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from './sidebar/menu';
import { SidebarProvider } from './sidebar/provider';
import { SidebarRoot } from './sidebar/root';
import { SidebarSlidingView, SidebarSlidingViews } from './sidebar/sliding';

export { useSidebar } from './sidebar/provider';
export type {
  SidebarContextValue,
  SidebarProviderProps,
  SidebarScrollAlign,
  SidebarScrollToItemOptions,
  SidebarState,
} from './sidebar/provider';
export type { SidebarSide, SidebarVariant } from './sidebar/shared';
export type { SidebarRootProps } from './sidebar/root';
export type {
  SidebarMenuButtonProps,
  SidebarMenuButtonSize,
  SidebarMenuItemProps,
  SidebarMenuSubButtonProps,
} from './sidebar/menu';
export type {
  SidebarCollapsibleProps,
  SidebarCollapsibleTriggerProps,
} from './sidebar/collapsible';
export type { SidebarSlidingViewProps, SidebarSlidingViewsProps } from './sidebar/sliding';

// ============================================================================
// Compound Component Export
// ============================================================================

/**
 * Sidebar — responsive navigation panel with expand/collapse support.
 *
 * Compound component: `Sidebar` (root `<aside>`), `.Provider`, `.Header`,
 * `.Content`, `.Footer`, `.Loading`, `.Group`, `.GroupLabel`,
 * `.Menu`, `.MenuItem`, `.MenuButton`, `.MenuBadge`,
 * `.MenuSub`, `.MenuSubItem`, `.MenuSubButton`, `.Separator`,
 * `.Trigger`, `.Close`, `.Rail`, `.ResizeHandle`, `.MenuChevron`,
 * `.Collapsible`, `.CollapsibleTrigger`, `.CollapsibleContent`,
 * `.SlidingViews`, `.SlidingView`.
 *
 * @example
 * ```tsx
 * <Sidebar.Provider defaultOpen>
 *   <Sidebar>
 *     <Sidebar.Content>
 *       <Sidebar.Group>
 *         <Sidebar.GroupLabel>Overview</Sidebar.GroupLabel>
 *         <Sidebar.Menu>
 *           <Sidebar.MenuButton icon={HouseIcon} active>Home</Sidebar.MenuButton>
 *           <Sidebar.MenuButton icon={GlobeIcon}>Domains</Sidebar.MenuButton>
 *         </Sidebar.Menu>
 *       </Sidebar.Group>
 *     </Sidebar.Content>
 *     <Sidebar.Footer>
 *       <Sidebar.Trigger />
 *     </Sidebar.Footer>
 *   </Sidebar>
 * </Sidebar.Provider>
 * ```
 */
export const Sidebar = Object.assign(SidebarRoot, {
  Provider: SidebarProvider,
  Header: SidebarHeader,
  Content: SidebarContent,
  Footer: SidebarFooter,
  Loading: SidebarLoading,
  Group: SidebarGroup,
  GroupLabel: SidebarGroupLabel,
  Menu: SidebarMenu,
  MenuItem: SidebarMenuItem,
  MenuButton: SidebarMenuButton,
  MenuBadge: SidebarMenuBadge,
  MenuSub: SidebarMenuSub,
  MenuSubItem: SidebarMenuSubItem,
  MenuSubButton: SidebarMenuSubButton,
  Separator: SidebarSeparator,
  Trigger: SidebarTrigger,
  Close: SidebarClose,
  Rail: SidebarRail,
  ResizeHandle: SidebarResizeHandle,
  MenuChevron: SidebarMenuChevron,
  Collapsible: SidebarCollapsible,
  CollapsibleTrigger: SidebarCollapsibleTrigger,
  CollapsibleContent: SidebarCollapsibleContent,
  SlidingViews: SidebarSlidingViews,
  SlidingView: SidebarSlidingView,
});

export {
  SidebarProvider,
  SidebarRoot,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarLoading,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarSeparator,
  SidebarTrigger,
  SidebarClose,
  SidebarRail,
  SidebarResizeHandle,
  SidebarMenuChevron,
  SidebarCollapsible,
  SidebarCollapsibleTrigger,
  SidebarCollapsibleContent,
  SidebarSlidingViews,
  SidebarSlidingView,
};
