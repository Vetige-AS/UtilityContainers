#!/bin/bash
# Verification script for UtilityContainers DevContainer update

set +e  # Don't exit on error, we want to count failures

echo "======================================================"
echo "  UtilityContainers DevContainer Update Verification"
echo "======================================================"
echo ""

PASS=0
FAIL=0

check_file() {
    local file=$1
    local description=$2
    if [ -f "$file" ]; then
        echo "✅ $description"
        ((PASS++))
    else
        echo "❌ $description - FILE MISSING: $file"
        ((FAIL++))
    fi
}

check_executable() {
    local file=$1
    local description=$2
    if [ -x "$file" ]; then
        echo "✅ $description"
        ((PASS++))
    else
        echo "❌ $description - NOT EXECUTABLE: $file"
        ((FAIL++))
    fi
}

echo "Checking new files..."
echo ""

# New documentation files
check_file "docs/DEVCONTAINER_INTEGRATION.md" "DevContainer Integration Guide exists"
check_file "CHANGELOG.md" "Changelog exists"
check_file "UPDATE_SUMMARY.md" "Update summary exists"

echo ""
echo "Checking new scripts..."
echo ""

# New scripts
check_file "scripts/setup-for-devcontainer.sh" "Setup script exists"
check_file "scripts/migrate-to-host-docker.sh" "Migration script exists"
check_executable "scripts/setup-for-devcontainer.sh" "Setup script is executable"
check_executable "scripts/migrate-to-host-docker.sh" "Migration script is executable"

echo ""
echo "Checking updated files..."
echo ""

# Updated files
check_file "QUICKSTART.new-project.md" "Quickstart guide exists"
check_file "README.md" "README exists"
check_file ".env.example" ".env.example exists"
check_file "docs/QUICK_REFERENCE.md" "Quick reference exists"

echo ""
echo "Checking content updates..."
echo ""

# Check for specific content in files
if grep -q "Docker-Outside-of-Docker" QUICKSTART.new-project.md; then
    echo "✅ QUICKSTART.new-project.md contains Docker-Outside-of-Docker section"
    ((PASS++))
else
    echo "❌ QUICKSTART.new-project.md missing Docker-Outside-of-Docker content"
    ((FAIL++))
fi

if grep -q "For DevContainer Projects" README.md; then
    echo "✅ README.md contains DevContainer Projects section"
    ((PASS++))
else
    echo "❌ README.md missing DevContainer Projects section"
    ((FAIL++))
fi

if grep -q "DevContainer Usage Notes" .env.example; then
    echo "✅ .env.example contains DevContainer usage notes"
    ((PASS++))
else
    echo "❌ .env.example missing DevContainer usage notes"
    ((FAIL++))
fi

if grep -q "docker-outside-of-docker" docs/QUICK_REFERENCE.md; then
    echo "✅ QUICK_REFERENCE.md updated with new approach"
    ((PASS++))
else
    echo "❌ QUICK_REFERENCE.md missing updates"
    ((FAIL++))
fi

echo ""
echo "======================================================"
echo "  Results: $PASS passed, $FAIL failed"
echo "======================================================"

if [ $FAIL -eq 0 ]; then
    echo ""
    echo "🎉 All checks passed! Update completed successfully."
    echo ""
    echo "📋 Next steps:"
    echo "   1. Review changes: git diff"
    echo "   2. Test in a project: scripts/setup-for-devcontainer.sh"
    echo "   3. Commit changes: git add -A && git commit -m 'Add devcontainer docker-outside-of-docker support'"
    echo ""
    exit 0
else
    echo ""
    echo "⚠️  Some checks failed. Please review the output above."
    echo ""
    exit 1
fi
