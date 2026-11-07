import type { Metadata } from 'next';
import { ShopCatalog } from '@/components/shop/shop-catalog';
import { TopNavigation } from '@/components/layout/top-navigation';
import { SITE_URL } from '@/lib/seo';

const TITLE = 'Shop Playza Sportswear';
const DESCRIPTION = 'Shop official Playza sportswear and performance tees in the colors you love. Choose your size from XS to XXXL, collect in New Cairo, or get delivery across Egypt for EGP 90.';
const OG_IMAGE = '/og-playza-shop.png';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: ['Playza sportswear', 'Playza shop', 'sports T-shirts Egypt', 'sportswear Egypt', 'performance tees', 'ملابس رياضية مصر', 'تيشيرتات بلايزا'],
  alternates: { canonical: '/shop' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/shop`,
    siteName: 'Playza',
    locale: 'en_US',
    alternateLocale: ['ar_EG'],
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Model wearing a Playza long-sleeve sports T-shirt in the Playza sportswear collection' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
};

export default function ShopPage() {
  return <><TopNavigation /><ShopCatalog /></>;
}
