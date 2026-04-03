import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    error: 'تم نقل البحث الذكي إلى الواجهة الداخلية مباشرة. هذه الواجهة لم تعد مستخدمة.',
  }, { status: 400 });
}
