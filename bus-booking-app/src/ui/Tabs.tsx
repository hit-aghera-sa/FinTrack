export interface TabDescriptor {
  id: string;
  label: string;
}

export interface TabsProps {
  tabs: ReadonlyArray<TabDescriptor>;
  activeId: string;
  onChange: (id: string) => void;
}

/**
 * The segmented tab strip (Upcoming / Past & cancelled). The current tab is marked with
 * `aria-selected` as well as the active style, so the choice is never colour-only.
 */
export function Tabs({ tabs, activeId, onChange }: TabsProps): JSX.Element {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className={active ? 'tab is-active' : 'tab'}
            aria-selected={active}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
