import { Suspense } from 'react';
import { ShopCheckout } from '@/components/shop/shop-checkout';
import { TopNavigation } from '@/components/layout/top-navigation';
export const metadata={title:'Shop checkout',robots:{index:false,follow:false}};
export default function Checkout(){return <><TopNavigation/><Suspense><ShopCheckout/></Suspense></>}
