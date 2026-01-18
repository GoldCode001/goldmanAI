app.post("/api/user", async (req, res) => {
  const { wallet_address, email } = req.body;

  if (!wallet_address || !email) {
    return res.status(400).json({ error: "missing fields" });
  }

  const { data, error } = await supabase
    .from("users")
    .upsert(
      { wallet_address, email },
      { onConflict: "wallet_address" }
    )
    .select()
    .single();

  if (error) {
    console.error(error);
    return res.status(500).json({ error: "db error" });
  }

  res.json(data);
});
