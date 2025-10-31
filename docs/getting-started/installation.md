# Installation Guide

## Prerequisites

**Required:**
- Bash 4.0+
- jq (JSON processor)

**Optional:**
- sqlite3 (for scaling > 500 items)
- Claude API key (for AI context extraction)

## Check Prerequisites

```bash
# Bash version
bash --version  # Should be 4.0+

# jq
jq --version  # Should be installed

# sqlite3 (optional)
sqlite3 --version  # Should be 3.0+
```

## Installation Methods

### Method 1: Git Clone (Recommended)

```bash
# Clone repository
git clone https://github.com/yourusername/later.git ~/Projects/later

# Run installation script
cd ~/Projects/later
./install.sh

# Verify
/later --version
```

### Method 2: Manual Installation

```bash
# Create directories
mkdir -p ~/.later/backups
mkdir -p ~/bin

# Copy commands
cp src/commands/* ~/bin/
chmod +x ~/bin/later-*

# Add to PATH (if needed)
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Create alias
echo 'alias later="later-capture"' >> ~/.bashrc
```

### Method 3: Homebrew (macOS)

```bash
# Install from tap (future)
brew tap yourusername/later
brew install later

# Verify
later --version
```

## Configuration

### Claude API Key (Optional)

```bash
# Set API key
export ANTHROPIC_API_KEY="sk-..."

# Add to profile
echo 'export ANTHROPIC_API_KEY="sk-..."' >> ~/.bashrc

# Or use ~/.later/config.json
cat > ~/.later/config.json <<EOF
{
  "api_key": "sk-...",
  "ai_model": "claude-haiku-4-5"
}
EOF
```

### Initial Setup

```bash
# Initialize data directory
mkdir -p ~/.later/backups

# Create empty data file
touch ~/.later/deferred.jsonl

# Set permissions
chmod 700 ~/.later
chmod 600 ~/.later/deferred.jsonl
```

## Platform-Specific

### Linux

```bash
# Install dependencies
sudo apt update
sudo apt install jq sqlite3

# Clone and install
git clone https://github.com/yourusername/later.git
cd later && ./install.sh
```

### macOS

```bash
# Install dependencies
brew install jq sqlite3

# Clone and install
git clone https://github.com/yourusername/later.git
cd later && ./install.sh
```

### WSL2 (Windows)

```bash
# Install dependencies
sudo apt update
sudo apt install jq sqlite3

# Clone to Windows filesystem (for iCloud sync)
cd /mnt/c/Users/<username>/iCloudDrive
git clone https://github.com/yourusername/later.git
cd later && ./install.sh
```

## Verification

```bash
# Check installation
/later --version
# Output: later v0.1.0

# Test capture
/later "Test installation"
# Output: ✅ Captured as item #1

# Test list
/later list
# Output: Shows item #1

# Test show
/later show 1
# Output: Shows details

# Test done
/later done 1
# Output: ✅ Item #1 marked as done
```

## Troubleshooting

### Command not found

```bash
# Check PATH
echo $PATH | grep "$HOME/bin"

# Add to PATH if missing
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### jq not found

```bash
# Linux
sudo apt install jq

# macOS
brew install jq

# Verify
jq --version
```

### Permission denied

```bash
# Fix permissions
chmod +x ~/bin/later-*
chmod 700 ~/.later
chmod 600 ~/.later/deferred.jsonl
```

### API key errors

```bash
# Check key is set
echo $ANTHROPIC_API_KEY

# If empty, set it
export ANTHROPIC_API_KEY="sk-..."

# Test without AI
/later "Test" --no-context
# Should work without API key
```

## Uninstallation

```bash
# Remove commands
rm ~/bin/later-*

# Remove data (optional, backs up first)
mv ~/.later ~/.later.backup

# Remove from PATH (edit ~/.bashrc)
# Remove line: export PATH="$HOME/bin:$PATH"
```

## Upgrading

```bash
# Pull latest
cd ~/Projects/later
git pull origin main

# Run upgrade script
./upgrade.sh

# Verify new version
/later --version
```

## Next Steps

- **[Quick Start](quick-start.md)** - Get productive in 5 minutes
- **[Basic Workflow](../examples/usage/basic-workflow.md)** - Common use cases
- **[Configuration](../technical/configuration.md)** - Advanced options

---

**Need help?** See [Troubleshooting](troubleshooting.md) or open an issue.
