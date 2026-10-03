import { requireSession } from "@/lib/session";
import { AcademyTrainingOffers, MyAcademyBookings } from "@/components/academies/training-booking";
export const metadata = { title: "Academy bookings" };
export default async function AcademyBookingsPage() {
 await requireSession();
 return <div className="space-y-8"><MyAcademyBookings/><AcademyTrainingOffers/></div>;
}
