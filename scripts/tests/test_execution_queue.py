import asyncio
import os
import sys
import uuid
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from execution.execution_queue import ExecutionQueue

async def test_queue():
    root = os.getcwd()
    eq = ExecutionQueue(root, concurrency=2)
    await eq.start()
    
    print("--- Running Queue Integration Tests ---")
    
    # 1. Enqueue multiple tasks
    tasks = [
        ("task1", [sys.executable, "--version"], root, "s1"),
        ("task2", [sys.executable, "-c", "import time; time.sleep(0.5); print('done')"], root, "s1"),
        ("task3", [sys.executable, "--version"], root, "s1")
    ]
    
    for t in tasks:
        await eq.enqueue(str(uuid.uuid4()), *t)
        
    await eq.queue.join()
    await eq.shutdown()
    
    print("Tests finished. Checking session persistence...")
    files = os.listdir(os.path.join(root, ".sessions"))
    print(f"Persisted sessions: {len(files)}")
    assert len(files) >= 3

if __name__ == "__main__":
    asyncio.run(test_queue())
