export interface Tier {
    id: string;
    label: string;
    color: string;
}

export interface TierItem {
    id: string;
    tier: string; // Must match a Tier.id or Tier.label
    imageUrl?: string;
    text?: string;
}

export interface TierListConfig {
    title?: string;
    tiers?: Tier[];
    items: TierItem[];
    backgroundColor?: string;
}

export const DEFAULT_TIERS: Tier[] = [
    { id: 'S', label: 'S', color: '#ff7f7f' },
    { id: 'A', label: 'A', color: '#ffbf7f' },
    { id: 'B', label: 'B', color: '#ffff7f' },
    { id: 'C', label: 'C', color: '#7fff7f' },
    { id: 'D', label: 'D', color: '#7f7fff' },
    { id: 'F', label: 'F', color: '#ff7fff' },
];
