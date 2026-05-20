import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from execution.sandbox import SandboxController

def test_sandbox():
    root = os.getcwd()
    sb = SandboxController(root)
    
    print("--- Running Sandbox Tests ---")
    
    # 1. Valid
    res1 = sb.validate_execution([sys.executable, "--version"], os.path.join(root, "scripts"))
    if not res1.is_valid:
        print(f"Debug: {res1.reason}")
    print(f"Test 1 (Valid): {'PASS' if res1.is_valid else 'FAIL'}")
    
    # 2. Blocked cmd
    res2 = sb.validate_execution(["rm", "-rf", "/"], os.path.join(root, "scripts"))
    print(f"Test 2 (Blocked Cmd): {'PASS' if not res2.is_valid else 'FAIL'}")
    
    # 3. Blocked dir
    res3 = sb.validate_execution([sys.executable, "-c", "print(1)"], "/etc")
    print(f"Test 3 (Blocked Dir): {'PASS' if not res3.is_valid else 'FAIL'}")

if __name__ == "__main__":
    test_sandbox()
