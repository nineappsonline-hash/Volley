import { Suspense } from 'react';
import { ShopCheckout } from '@/components/shop/shop-checkout';
export const metadata={title:'Shop checkout',robots:{index:false,follow:false}};
export default function Checkout(){return <Suspense><ShopCheckout/></Suspense>}
