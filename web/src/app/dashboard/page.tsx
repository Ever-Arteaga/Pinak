"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser, logoutUser } from "@/lib/auth";
import { useBusiness } from "@/lib/business";
import { useBusinessGate } from "@/components/BusinessGate";
import { usePrivacy } from "@/lib/privacy";
import { useDashboard, type DashboardPeriod } from "@/lib/dashboard";
import { AddTransactionModal } from "@/components/AddTransactionModal";
import { AiQuickAddModal } from "@/components/AiQuickAddModal";
import { AppHeader } from "@/components/AppHeader";
import { InvitationsBanner } from "@/components/InvitationsBanner";
import { ExpiryBanner } from "@/components/ExpiryBanner";
import { SetupBanner } from "@/components/SetupBanner";
import { DashboardView } from "@/components/dashboard/DashboardView";
import type { Transaction } from "@/types/pinak";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const { business } = useBusiness();
  const { money, available, enabled, toggle } = usePrivacy();

  const [period, setPeriod] = useState<DashboardPeriod>("30d");
  const dash = useDashboard(business?.id, period);

  const [showModal, setShowModal] = useState(false);
  const [aiRequest, setAiRequest] = useState<{ text: string; voice: boolean } | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  const gate = useBusinessGate();
  if (gate) return gate;
  const biz = business!;

  return (
    <>
      <DashboardView
        businessName={biz.name}
        plan={biz.plan}
        userName={user?.displayName?.trim().split(/\s+/)[0] || biz.name}
        period={period}
        onPeriodChange={setPeriod}
        dash={dash}
        money={money}
        privacy={{ available, enabled, toggle: () => void toggle() }}
        onNewTransaction={() => setShowModal(true)}
        onAiDetect={(text, voice) => setAiRequest({ text, voice })}
        onSelectTransaction={setEditingTransaction}
        header={<AppHeader onLogout={() => logoutUser()} />}
        banner={<><InvitationsBanner /><ExpiryBanner /><SetupBanner /></>}
      />

      {showModal && <AddTransactionModal businessId={biz.id} onClose={() => setShowModal(false)} />}

      {aiRequest && (
        <AiQuickAddModal
          businessId={biz.id}
          initialText={aiRequest.text}
          initialVoice={aiRequest.voice}
          onClose={() => setAiRequest(null)}
        />
      )}

      {editingTransaction && (
        <AddTransactionModal
          businessId={biz.id}
          editingTransaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
        />
      )}
    </>
  );
}
