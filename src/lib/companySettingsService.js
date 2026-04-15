import { supabase } from "./supabase";

export async function getCurrentUserOrThrow() {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data?.user) {
    throw new Error("User belum login.");
  }

  return data.user;
}

export async function fetchCompanySettings(userId) {
  const { data, error } = await supabase
    .from("company_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertCompanySettings(payload) {
  const { data, error } = await supabase
    .from("company_settings")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function uploadCompanyLogo(file, userId) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const filePath = `${userId}/logo-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("company-logos")
    .upload(filePath, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from("company-logos")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/* =========================================
   PUBLIC: AMBIL COMPANY SETTINGS VIA RPC
========================================= */
export async function fetchPublicCompanySettings(userId) {
  if (!userId) {
    throw new Error("User ID public tidak ditemukan.");
  }

  const { data, error } = await supabase.rpc("get_public_company_settings", {
    p_user_id: userId,
  });

  if (error) {
    console.error("fetchPublicCompanySettings RPC error:", error);
    throw error;
  }

  if (Array.isArray(data)) {
    return data[0] || null;
  }

  return data || null;
}

/* =========================================
   ALIAS AGAR COCOK DENGAN IMPORT DI PUBLICBOOKINGINVOICEMODAL
========================================= */
export async function fetchCompanySettingsByUserId(userId) {
  return await fetchPublicCompanySettings(userId);
}