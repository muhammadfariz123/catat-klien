import { supabase } from "../lib/supabase";

export async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error) {
    alert(error.message);
  }
}
