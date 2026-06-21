#!/usr/bin/env node

import 'dotenv/config';
import fetch from 'node-fetch';

const SHOP = process.env.SHOPIFY_SHOP;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = '2025-01';

if (!SHOP || !TOKEN) {
  console.error("Missing env variables: SHOPIFY_SHOP or SHOPIFY_ADMIN_TOKEN");
  process.exit(1);
}

//-----------------------------------------
// REAL STORE LOGIC (Crony.ae)
//-----------------------------------------
const CATEGORY_RULES = [
  { match: "scooter", comp: "performance-e-scooter" },
  { match: "commuter-e-scooters", comp: "scooter" },
  { match: "off-road-e-scooters", comp: "scooter" },
  { match: "kids-e-scooter", comp: "scooter" },
  { match: "harley-electric-motorcycle", comp: "performance-e-scooter" },
  { match: "electric-bicycles", comp: "scooter" },

  { match: "walkie-talkies", comp: "power-bank" },

  { match: "projectors", comp: "projection-screens" },
  { match: "projection-screens", comp: "projectors" },

  { match: "surveillance-cameras", comp: "spy-cameras" },
  { match: "spy-cameras", comp: "surveillance-cameras" },

  { match: "laser-stage-light", comp: "fog-machine" },
  { match: "fog-machine", comp: "laser-stage-light" },

  { match: "speaker", comp: "power-bank" },
  { match: "jumper-starter", comp: "power-bank" },

  { match: "electric-portable-incense-bukhoor", comp: "teacup-bukhoor" },

  { match: "camping-tools", comp: "summer-special" },
  { match: "wheelchairs", comp: "health-&-protection" },
  { match: "digital-photo-frame", comp: "projectors" },
];

const FALLBACK = "best-sellers";
const COMPLEMENTARY_LIMIT = 2;
const GRAPHQL = `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;

async function gql(query, variables = {}) {
  const res = await fetch(GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": TOKEN
    },
    body: JSON.stringify({ query, variables })
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

const PRODUCT_QUERY = `
query getProducts($cursor: String){
  products(first: 100, after:$cursor){
    edges{
      cursor
      node{
        id
        handle
        title
        collections(first:20){edges{node{handle}}}
        metafield(namespace:"shopify--discovery--product_recommendation", key:"complementary_products"){
          id value type
        }
      }
    }
    pageInfo{ hasNextPage endCursor }
  }
}`;

const COL_QUERY = `
query($handle:String!){
  collection(handle:$handle){
    products(first:100){
      edges{node{id title}}
    }
  }
}`;

const SET_META = `
mutation setMeta($metafields:[MetafieldsSetInput!]!){
  metafieldsSet(metafields:$metafields){
    userErrors{message field}
  }
}`;

async function loadCollection(handle) {
  const data = await gql(COL_QUERY, { handle });
  return data.collection?.products?.edges?.map(e => e.node.id) || [];
}

async function run() {
  console.log("\nRunning complementary autofill...");

  const cached = {};

  const getPool = async (handle) => {
    if (!cached[handle]) cached[handle] = await loadCollection(handle);
    return cached[handle];
  };

  let cursor = null, updated = 0;

  while (true) {
    const data = await gql(PRODUCT_QUERY, { cursor });
    const page = data.products;

    for (const { node: product } of page.edges) {
      const handles = product.collections.edges.map(e => e.node.handle);
      const existing = product.metafield?.value ? JSON.parse(product.metafield.value) : [];

      if (existing.length >= COMPLEMENTARY_LIMIT) continue;

      const matchRule = CATEGORY_RULES.find(r =>
        handles.includes(r.match)
      );

      const target = matchRule?.comp || FALLBACK;
      const pool = (await getPool(target)).filter(id => id !== product.id);
      const selected = pool.slice(0, COMPLEMENTARY_LIMIT);

      if (!selected.length) continue;

      await gql(SET_META, {
        metafields: [{
          ownerId: product.id,
          namespace: "shopify--discovery--product_recommendation",
          key: "complementary_products",
          type: "list.product_reference",
          value: JSON.stringify(selected)
        }]
      });

      updated++;
      console.log(`✓ Updated: ${product.title} → ${target}`);
    }

    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }

  console.log("\nCompleted.");
  console.log(`Products updated: ${updated}\n`);
}

run().catch(e => console.error(e));
