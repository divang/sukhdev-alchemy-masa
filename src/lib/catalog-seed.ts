import type { Category, Product } from "@/lib/types"

const DEFAULT_BRAND_NAME = "SukhDevi Alchemy Spices"
const DEFAULT_GTIN = "29EAGPS2390M1ZX"
const DEFAULT_FSSAI = "21226010003872"

const CATEGORY_LABELS: Record<string, string> = {
  "premium-masala": "Premium Blended Masala",
  "combo-pack-masala": "Combo Pack Masala",
  "raw-organic-spices": "Raw Organic Spices",
}

export const CATALOG_SEED_CATEGORIES: Category[] = [
  {
    id: "premium-masala",
    name: "Premium Blended Masala",
    slug: "premium-masala",
    enabled: true,
  },
  {
    id: "combo-pack-masala",
    name: "Combo Pack Masala",
    slug: "combo-pack-masala",
    enabled: true,
  },
  {
    id: "raw-organic-spices",
    name: "Raw Organic Spices",
    slug: "raw-organic-spices",
    enabled: true,
  },
]

const BASE_CATALOG_SEED_PRODUCTS: Product[] = [
  {
    id: "garam-masala-premium",
    name: "Mix Masala Premium Blend",
    category: "premium-masala",
    price: 240,
    compareAtPrice: 315,
    discountPercent: 25,
    packGrams: 75,
    image: "images/products/garam-masala-premium.png",
    rating: 4.8,
    reviewCount: 0,
    description:
      "Our flagship, rich, and highly aromatic blend crafted with rare and expensive spices like Stone Flower, Long Pepper, and Mace. No added salt or fillers.",
    ingredients: [
      "Cumin (Jeera)",
      "Caraway Seeds (Shahi Jeera)",
      "Black Cardamom (Badi Elaichi)",
      "Coriander (Dhaniya)",
      "Black Pepper (Kali Mirch)",
      "White Pepper (Safed Mirch)",
      "Cloves (Laung)",
      "Green Cardamom (Choti Elaichi)",
      "Mace (Javitri)",
      "Turmeric (Haldi)",
      "Poppy Seeds (Khas Khas)",
      "Dried Fenugreek Leaves (Kasuri Methi)",
      "Cinnamon (Dalchini)",
      "Nutmeg (Jaiphal)",
      "Long Pepper (Pipali)",
      "Star Anise (Chakra Phool)",
      "Stone Flower (Patthar Phool)",
      "Bay Leaf (Tej Patta)",
    ],
    youtubeUrl: "https://youtu.be/pDOFN9OEKt4?si=RyDFBeFCk1LY0ZHi",
    inStock: true,
    tags: ["bestseller", "premium", "aromatic", "discount-25"],
    modelNumber: "SDA-GM-75",
  },
  {
    id: "bharwa-masala-premium",
    name: "Bharwa Masala Premium",
    category: "premium-masala",
    price: 143,
    compareAtPrice: 188,
    discountPercent: 25,
    packGrams: 75,
    image: "images/products/bharwa-masala-premium.png",
    rating: 4.7,
    reviewCount: 0,
    description:
      "A fragrant, coarsely ground blend dominated by roasted cumin and fennel. Designed specifically to bring out the best in stuffed karela, bhindi, or baingan.",
    ingredients: [
      "Cumin (Jeera)",
      "Fennel (Saunf)",
      "Coriander (Dhaniya)",
      "Dry Mango Powder (Amchoor)",
      "Red Chilli (Lal Mirch)",
      "Edible Common Salt",
      "Turmeric (Haldi)",
    ],
    youtubeUrl: "https://youtu.be/pDOFN9OEKt4?si=RyDFBeFCk1LY0ZHi",
    inStock: true,
    tags: ["premium", "stuffed-veggies", "tangy", "discount-25"],
    modelNumber: "SDA-BM-75",
  },
  {
    id: "chat-masala-premium",
    name: "Chaat Masala Premium",
    category: "premium-masala",
    price: 158,
    compareAtPrice: 218,
    discountPercent: 25,
    packGrams: 75,
    image: "images/products/chat-masala-premium.png",
    rating: 4.9,
    reviewCount: 0,
    description:
      "A highly addictive, lip-smacking blend that balances tartness with a spicy kick. Perfect for sprinkling on fruits, salads, and street-style snacks.",
    ingredients: [
      "Cumin (Jeera)",
      "Dry Mango Powder (Amchoor)",
      "Coriander (Dhaniya)",
      "Black Salt (Kala Namak)",
      "Edible Common Salt",
      "Black Pepper (Kali Mirch)",
      "White Pepper (Safed Mirch)",
      "Red Chilli (Lal Mirch)",
      "Dry Ginger (Sonth)",
      "Tartaric Acid (Tatri)",
      "Sugar",
      "Dried Gooseberry (Amla)",
      "Carom Seeds (Ajwain)",
    ],
    youtubeUrl: "https://youtu.be/pDOFN9OEKt4?si=RyDFBeFCk1LY0ZHi",
    inStock: true,
    tags: ["bestseller", "premium", "tangy", "street-food", "discount-25"],
    modelNumber: "SDA-CM-75",
  },
  {
    id: "chhole-masala-premium",
    name: "Chole Masala Premium",
    category: "premium-masala",
    price: 180,
    compareAtPrice: 240,
    discountPercent: 25,
    packGrams: 75,
    image: "images/products/chhole-masala-premium.png",
    rating: 4.8,
    reviewCount: 0,
    description:
      "A perfectly balanced, dark, and tangy blend featuring premium Bedgi chillies and Anardana for that authentic Punjabi Chole flavor.",
    ingredients: [
      "Coriander (Dhaniya)",
      "Cumin (Jeera)",
      "Dry Mango Powder (Amchoor)",
      "Fennel (Saunf)",
      "Pomegranate Seeds (Anardana)",
      "Black Pepper (Kali Mirch)",
      "Bedgi Red Chilli",
      "Black Cardamom (Badi Elaichi)",
      "Cinnamon (Dalchini)",
      "Green Cardamom (Choti Elaichi)",
      "Cloves (Laung)",
      "Dry Ginger (Sonth)",
      "Black Salt (Kala Namak)",
      "Rock Salt (Sendha Namak)",
      "Bay Leaf (Tej Patta)",
      "Carom Seeds (Ajwain)",
      "Turmeric (Haldi)",
      "White Pepper (Safed Mirch)",
      "Dried Fenugreek Leaves (Kasuri Methi)",
      "Mace (Javitri)",
      "Caraway Seeds (Shahi Jeera)",
      "Kachri",
    ],
    youtubeUrl: "https://youtu.be/pDOFN9OEKt4?si=RyDFBeFCk1LY0ZHi",
    inStock: true,
    tags: ["premium", "punjabi", "aromatic", "discount-25"],
    modelNumber: "SDA-CHM-75",
  },
  {
    id: "sukhdevi-combo-pack",
    name: "Sukhdevi Combo Pack",
    category: "combo-pack-masala",
    price: 640,
    packGrams: 200,
    image: "images/products/SDA-Combo-Pack.jpeg",
    rating: 5,
    reviewCount: 0,
    description:
      "All four signature 50g masalas in one order: Bharwa Masala, Chaat Masala, Chole Masala, and Mix Masala Premium Blend. Free shipping applies automatically because the combo subtotal is above 500 INR.",
    ingredients: [
      "1 x Bharwa Masala 50g",
      "1 x Chaat Masala 50g",
      "1 x Chole Masala 50g",
      "1 x Mix Masala Premium Blend 50g",
    ],
    youtubeUrl: "https://youtu.be/pDOFN9OEKt4?si=RyDFBeFCk1LY0ZHi",
    inStock: true,
    tags: ["combo-pack", "free-shipping", "giftable"],
    modelNumber: "SDA-COMBO-200",
  },
  {
    id: "raw-cardamom-black",
    name: "Raw Black Cardamom",
    category: "raw-organic-spices",
    price: 140,
    packGrams: 50,
    image: "images/products/Raw-Cardamom-Black-8inch.JPG",
    rating: 5,
    reviewCount: 0,
    description: "Bold and smoky black cardamom pods sourced for authentic Indian gravies and biryanis.",
    ingredients: ["Black Cardamom (Badi Elaichi)"],
    inStock: true,
    tags: ["raw", "organic", "whole-spice"],
  },
  {
    id: "raw-cardamom-green",
    name: "Raw Green Cardamom",
    category: "raw-organic-spices",
    price: 260,
    packGrams: 50,
    image: "images/products/Raw-Cardamom-Green-8inch.JPG",
    rating: 5,
    reviewCount: 0,
    description: "Premium aromatic green cardamom for desserts, tea, and spice blends.",
    ingredients: ["Green Cardamom (Choti Elaichi)"],
    inStock: true,
    tags: ["raw", "organic", "whole-spice"],
  },
  {
    id: "raw-clove",
    name: "Raw Clove",
    category: "raw-organic-spices",
    price: 90,
    packGrams: 50,
    image: "images/products/Raw-Clove.JPG",
    rating: 5,
    reviewCount: 0,
    description: "Strong and fragrant cloves ideal for tempering, pulao, and masala chai.",
    ingredients: ["Cloves (Laung)"],
    inStock: true,
    tags: ["raw", "organic", "whole-spice"],
  },
  {
    id: "raw-cumin",
    name: "Raw Cumin",
    category: "raw-organic-spices",
    price: 50,
    packGrams: 50,
    image: "images/products/Raw-Cumin.JPG",
    rating: 5,
    reviewCount: 0,
    description: "Clean and earthy cumin seeds for daily tadka and roasting blends.",
    ingredients: ["Cumin (Jeera)"],
    inStock: true,
    tags: ["raw", "organic", "whole-spice"],
  },
  {
    id: "raw-fennel-lucknow",
    name: "Raw Fennel",
    category: "raw-organic-spices",
    price: 25,
    packGrams: 50,
    image: "images/products/Raw-Fennel-Lucknow.JPG",
    rating: 5,
    reviewCount: 0,
    description: "Sweet Lucknow fennel with bright aroma for curries, pickles, and mouth fresheners.",
    ingredients: ["Fennel (Saunf)"],
    inStock: true,
    tags: ["raw", "organic", "whole-spice"],
  },
  {
    id: "raw-guntur-chilli",
    name: "Raw Cuntur Chilli",
    category: "raw-organic-spices",
    price: 25,
    packGrams: 50,
    image: "images/products/Raw-Guntur-Chilli.JPG",
    rating: 5,
    reviewCount: 0,
    description: "Classic Guntur red chilli for vibrant color and medium heat in Indian dishes.",
    ingredients: ["Guntur Red Chilli"],
    inStock: true,
    tags: ["raw", "organic", "whole-spice"],
  },
  {
    id: "raw-pepper-black",
    name: "Raw Black Pepper",
    category: "raw-organic-spices",
    price: 80,
    packGrams: 50,
    image: "images/products/Raw-Pepper-Black.JPG",
    rating: 5,
    reviewCount: 0,
    description: "Sharp and woody black peppercorns suitable for seasoning and fresh grinding.",
    ingredients: ["Black Pepper (Kali Mirch)"],
    inStock: true,
    tags: ["raw", "organic", "whole-spice"],
  },
  {
    id: "raw-star-anise",
    name: "Raw Star Anise",
    category: "raw-organic-spices",
    price: 80,
    packGrams: 50,
    image: "images/products/Raw-Star-Anise.JPG",
    rating: 5,
    reviewCount: 0,
    description: "Licorice-forward star anise pods for biryani, broths, and slow-cooked gravies.",
    ingredients: ["Star Anise (Chakra Phool)"],
    inStock: true,
    tags: ["raw", "organic", "whole-spice"],
  },
  {
    id: "raw-tej-patta",
    name: "Raw Tej Patta",
    category: "raw-organic-spices",
    price: 40,
    packGrams: 50,
    image: "images/products/Raw-Tej-Patta.JPG",
    rating: 5,
    reviewCount: 0,
    description: "Aromatic bay leaves to deepen flavor in dals, rice, and gravies.",
    ingredients: ["Bay Leaf (Tej Patta)"],
    inStock: true,
    tags: ["raw", "organic", "whole-spice"],
  },
  {
    id: "raw-turmeric",
    name: "Raw Turmeric",
    category: "raw-organic-spices",
    price: 35,
    packGrams: 50,
    image: "images/products/Raw-Turmeric.JPG",
    rating: 5,
    reviewCount: 0,
    description: "Natural turmeric fingers for grinding fresh haldi powder and immunity blends.",
    ingredients: ["Turmeric (Haldi)"],
    inStock: true,
    tags: ["raw", "organic", "whole-spice"],
  },
]

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function inferShortDescription(description: string) {
  const firstSentence = description.split(".")[0]?.trim()
  if (firstSentence) {
    return `${firstSentence}.`
  }

  return description
}

function inferHighlights(product: Product) {
  const packGrams = product.packGrams ?? 50
  const isRawSpice = product.category === "raw-organic-spices"

  if (isRawSpice) {
    return [
      "Single-ingredient whole spice",
      `Net quantity: ${packGrams}g`,
      "Packed for freshness and daily kitchen use",
    ]
  }

  return [
    "Crafted in small batches for consistent aroma",
    `Net quantity: ${packGrams}g`,
    "Ingredient panel is clearly declared on this page",
  ]
}

function inferMaterialInfo(product: Product) {
  if (product.category === "raw-organic-spices") {
    return "Whole spice"
  }

  if (product.category === "combo-pack-masala") {
    return "Combo pack of blended spice pouches"
  }

  return "Ground spice blend"
}

function inferModelNumber(product: Product) {
  if (product.modelNumber?.trim()) {
    return product.modelNumber.trim()
  }

  return `SDA-${product.id.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`
}

function inferBreadcrumb(product: Product) {
  const categoryName = CATEGORY_LABELS[product.category] ?? product.category
  return ["Home", "Products", categoryName, product.name]
}

export const CATALOG_SEED_PRODUCTS: Product[] = BASE_CATALOG_SEED_PRODUCTS.map((product) => {
  const packGrams = product.packGrams ?? 50

  return {
    ...product,
    slug: toSlug(product.id),
    brandName: product.brandName ?? DEFAULT_BRAND_NAME,
    shortDescription: product.shortDescription ?? inferShortDescription(product.description),
    highlights: product.highlights && product.highlights.length > 0 ? product.highlights : inferHighlights(product),
    modelNumber: inferModelNumber(product),
    mpn: product.mpn ?? product.sku,
    gtin: product.gtin ?? DEFAULT_GTIN,
    variantData: product.variantData && product.variantData.length > 0
      ? product.variantData
      : [`Pack Size: ${packGrams}g`],
    netQuantityValue: product.netQuantityValue ?? packGrams,
    netQuantityUnit: product.netQuantityUnit ?? "g",
    materialInfo: product.materialInfo ?? inferMaterialInfo(product),
    complianceInfo: product.complianceInfo && product.complianceInfo.length > 0
      ? product.complianceInfo
      : [
          `FSSAI Lic. No.: ${DEFAULT_FSSAI}`,
          `GTIN/GSTIN: ${DEFAULT_GTIN}`,
          "Store in a cool and dry place",
          "Keep away from moisture and direct sunlight",
          "Review ingredient and allergen suitability before consumption",
        ],
    additionalImages: product.additionalImages ?? [],
    categoryBreadcrumb: product.categoryBreadcrumb && product.categoryBreadcrumb.length > 0
      ? product.categoryBreadcrumb
      : inferBreadcrumb(product),
  }
})
