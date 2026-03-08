import { redirect } from 'next/navigation';

export default function PatientProfilePage(): never {
  redirect('/patient/profile/settings');
}
