import type { CategoryOption } from "@/lib/finance/types";

export const INITIAL_CATEGORIES: CategoryOption[] = [
  { id: "00000000-0000-0000-0000-000000000001", slug: "food", name: "食費", sortOrder: 1 },
  {
    id: "00000000-0000-0000-0000-000000000002",
    slug: "daily-necessities",
    name: "日用品",
    sortOrder: 2
  },
  { id: "00000000-0000-0000-0000-000000000003", slug: "luxury", name: "嗜好品", sortOrder: 3 },
  { id: "00000000-0000-0000-0000-000000000004", slug: "social", name: "交際費", sortOrder: 4 },
  {
    id: "00000000-0000-0000-0000-000000000005",
    slug: "transportation",
    name: "交通費",
    sortOrder: 5
  },
  { id: "00000000-0000-0000-0000-000000000006", slug: "health", name: "医療・健康", sortOrder: 6 },
  {
    id: "00000000-0000-0000-0000-000000000007",
    slug: "entertainment",
    name: "趣味・娯楽",
    sortOrder: 7
  },
  {
    id: "00000000-0000-0000-0000-000000000008",
    slug: "fashion-beauty",
    name: "被服・美容",
    sortOrder: 8
  },
  {
    id: "00000000-0000-0000-0000-000000000009",
    slug: "communication",
    name: "通信",
    sortOrder: 9
  },
  {
    id: "00000000-0000-0000-0000-000000000010",
    slug: "utilities",
    name: "水道・光熱費",
    sortOrder: 10
  },
  { id: "00000000-0000-0000-0000-000000000011", slug: "housing", name: "住居", sortOrder: 11 },
  {
    id: "00000000-0000-0000-0000-000000000012",
    slug: "education",
    name: "教育・自己投資",
    sortOrder: 12
  },
  { id: "00000000-0000-0000-0000-000000000013", slug: "special", name: "特別支出", sortOrder: 13 },
  { id: "00000000-0000-0000-0000-000000000014", slug: "other", name: "その他", sortOrder: 14 }
];
