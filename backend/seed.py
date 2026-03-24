"""
초기 데이터 시딩 스크립트.
python seed.py 로 실행.
"""
from datetime import date
from database import SessionLocal, Base, engine
from models import Department, Report, ReportItem, DeptStatus, Category, ReportType

Base.metadata.create_all(bind=engine)

DEPARTMENTS = [
    "기획조정실",
    "정보화지원실",
    "교육운영팀",
    "대외협력팀",
]

def seed():
    db = SessionLocal()
    try:
        # 부서 시딩
        for name in DEPARTMENTS:
            if not db.query(Department).filter_by(name=name).first():
                db.add(Department(name=name))
        db.commit()

        # 보고서 시딩 (이번 주)
        depts = db.query(Department).all()
        report = db.query(Report).filter_by(title="2026년 13주차 업무보고").first()
        if not report:
            report = Report(
                title="2026년 13주차 업무보고",
                start_date=date(2026, 3, 23),
                end_date=date(2026, 3, 29),
                type=ReportType.weekly,
            )
            db.add(report)
            db.commit()
            db.refresh(report)

            # 부서별 상태 생성
            for dept in depts:
                db.add(DeptStatus(report_id=report.id, dept_id=dept.id))
            db.commit()

        # 이전 주 보고서 (롤오버 테스트용)
        prev_report = db.query(Report).filter_by(title="2026년 12주차 업무보고").first()
        if not prev_report:
            prev_report = Report(
                title="2026년 12주차 업무보고",
                start_date=date(2026, 3, 16),
                end_date=date(2026, 3, 22),
                type=ReportType.weekly,
            )
            db.add(prev_report)
            db.commit()
            db.refresh(prev_report)

            for dept in depts:
                db.add(DeptStatus(report_id=prev_report.id, dept_id=dept.id))
            db.commit()

            # 첫 번째 부서에 샘플 계획 항목 추가 (롤오버 테스트)
            first_dept = depts[0]
            sample_plans = [
                (1, "정보시스템 개선 추진"),
                (2, "사용자 요구사항 분석 및 기능 명세서 작성"),
                (2, "개발사 미팅 일정 조율"),
                (3, "1차 미팅: 3/18(수) 14:00"),
                (1, "내부 교육 계획 수립"),
                (2, "교육 대상자 명단 확정"),
            ]
            for i, (level, content) in enumerate(sample_plans):
                db.add(ReportItem(
                    report_id=prev_report.id,
                    dept_id=first_dept.id,
                    category=Category.plan,
                    level=level,
                    content=content,
                    display_order=i,
                ))
            db.commit()

        print("✅ 시딩 완료!")
        print(f"  - 부서: {len(depts)}개")
        print(f"  - 보고서: 12주차, 13주차")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
