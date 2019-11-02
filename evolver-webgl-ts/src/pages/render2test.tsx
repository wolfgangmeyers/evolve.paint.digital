import * as React from "react";

export const render2test: React.FC = () => {
    return (
        <div className="row">
            <div className="col-lg-8 offset-lg-2 col-md-12">
                <div className="card border-primary mb-3">
                    <div className="card-header">
                        <h4 className="text-center">Sandbox</h4>

                    </div>
                    <div className="card-body">
                        <div className="row">
                            <div className="col-sm-12">
                                <canvas id="c" width="1024" height="1024" style={{ width: "100%", border: "1px solid black" }}></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
