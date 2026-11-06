import type { Metadata } from 'next';
import { ShopCatalog } from '@/components/shop/shop-catalog';
import { TopNavigation } from '@/components/layout/top-navigation';
export const metadata:Metadata={title:'Playza Shop',description:'Shop Playza products. Choose your color and size, with collection or delivery.'};
export default function ShopPage(){return <><TopNavigation/><ShopCatalog/></>}
