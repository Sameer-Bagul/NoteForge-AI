use keyring::Entry;

const SERVICE_NAME: &str = "noteforge_ai";

pub struct KeychainVault;

impl KeychainVault {
    pub fn set_key(provider: &str, key: &str) -> Result<(), String> {
        let entry = Entry::new(SERVICE_NAME, provider)
            .map_err(|e| format!("Failed to create keyring entry: {e}"))?;
        
        entry
            .set_password(key)
            .map_err(|e| format!("Failed to save secret to keychain: {e}"))?;
            
        Ok(())
    }

    pub fn get_key(provider: &str) -> Result<Option<String>, String> {
        let entry = Entry::new(SERVICE_NAME, provider)
            .map_err(|e| format!("Failed to access keyring: {e}"))?;

        match entry.get_password() {
            Ok(pwd) => Ok(Some(pwd)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("Keyring retrieval error: {e}")),
        }
    }

    pub fn delete_key(provider: &str) -> Result<(), String> {
        let entry = Entry::new(SERVICE_NAME, provider)
            .map_err(|e| format!("Failed to access keyring: {e}"))?;

        match entry.delete_credential() {
            Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("Failed to delete key: {e}")),
        }
    }
}

